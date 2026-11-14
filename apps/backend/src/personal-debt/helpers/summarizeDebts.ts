import { CurrencyService } from 'src/currency/currency.service';
import { BadRequestException } from '@nestjs/common';
import { PrismaPersonalDebtRepository } from '../repositories/prisma/prisma-personal-debt-repository';
import { DebtCurrency } from '../repositories/personal-debt-repository';
import {
  DEFAULT_DUE_MONTHS,
  DEFAULT_SUMMARY_FUTURE,
  DEFAULT_SUMMARY_MONTHS,
  DebtSummaryQueryDto,
  MAX_DEBT_RANGE_MONTHS,
} from '../dto/debt-query.dto';
import { debtState } from './debtState';
import { dueWindowStart } from './dueWindowStart';
import { listDebtsDue } from './listDebtsDue';
import { presentDebt } from './presentDebt';
import { projectDebt } from './projectDebt';

// Sem moeda escolhida nem dívidas, conta-se nesta
const FALLBACK_CURRENCY = 'EUR';
// Quantas prestações vão na lista do dashboard
const UPCOMING_LIMIT = 8;

const round = (value: number) => Math.round(value * 100) / 100;
const iso = (date: Date) => date.toISOString().slice(0, 10);

/**
 * O dashboard das dívidas, tudo numa moeda (a escolhida, ou a mais usada; as
 * outras pela cotação do dia: os movimentos no dia deles, o saldo de cada mês no último dia, o resto e a projeção na de hoje): o saldo em dívida e o que devem à
 * pessoa no fim de cada um dos últimos `months` meses (pelos movimentos) e a
 * projeção dos `future` à frente (a pagar a prestação, com os juros), o pago e
 * os juros de cada mês, os cartões, por tipo, cada dívida e as próximas
 * prestações. As fechadas não contam. Com `from`–`to` (meses) o gráfico é desse
 * intervalo, no lugar de `months` e `future`; os cartões não mudam.
 */
export async function summarizeDebts(
  userId: string,
  query: DebtSummaryQueryDto,
  repository: PrismaPersonalDebtRepository,
  currencyService: CurrencyService,
) {
  const months = query.months ?? DEFAULT_SUMMARY_MONTHS;
  const future = query.future ?? DEFAULT_SUMMARY_FUTURE;
  const now = new Date();
  const today = iso(now);
  const currentMonth = today.slice(0, 7);
  let firstMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1),
  );
  let slots = months + future;

  // O gráfico: o intervalo escolhido à mão, ou os meses para trás e a projeção
  if (query.from || query.to) {
    if (!query.from || !query.to)
      throw new BadRequestException('O intervalo precisa do início e do fim');
    const [fromYear, fromMonth] = query.from.split('-').map(Number);
    const [toYear, toMonth] = query.to.split('-').map(Number);
    slots = (toYear - fromYear) * 12 + toMonth - fromMonth + 1;
    if (slots < 1)
      throw new BadRequestException(
        'O fim do intervalo não pode ser antes do início',
      );
    if (slots > MAX_DEBT_RANGE_MONTHS)
      throw new BadRequestException(
        `O intervalo não pode ter mais de ${MAX_DEBT_RANGE_MONTHS} meses`,
      );
    firstMonth = new Date(Date.UTC(fromYear, fromMonth - 1, 1));
  }

  const debts = (await repository.findDebts(userId)).filter(
    (debt) => debt.status !== 'closed',
  );

  // A moeda: a pedida, senão a das dívidas mais usada, senão o euro
  let currency: DebtCurrency | null = query.currencyId
    ? await repository.findCurrency(query.currencyId)
    : null;
  if (!currency) {
    const uses = new Map<string, number>();
    for (const debt of debts)
      uses.set(debt.currencyId, (uses.get(debt.currencyId) ?? 0) + 1);
    const top = [...uses.entries()].sort((a, b) => b[1] - a[1])[0];
    currency = top
      ? await repository.findCurrency(top[0])
      : await repository.findCurrencyByCode(FALLBACK_CURRENCY);
  }
  const target = currency;
  // O último dia de cada mês já passado (o atual, hoje): o dia do saldo desse mês
  const monthEnds: string[] = [];
  for (let index = 0; index < slots; index += 1) {
    const end = iso(
      new Date(
        Date.UTC(
          firstMonth.getUTCFullYear(),
          firstMonth.getUTCMonth() + index + 1,
          0,
        ),
      ),
    );
    if (end.slice(0, 7) <= currentMonth)
      monthEnds.push(end < today ? end : today);
  }
  const converter = await currencyService.converter(
    target,
    debts.flatMap((debt) => [
      { currency: debt.currency },
      ...monthEnds.map((day) => ({ currency: debt.currency, day })),
      ...debt.movements.map((movement) => ({
        currency: debt.currency,
        day: iso(movement.date),
        hour: movement.rateHour,
      })),
    ]),
  );
  const convert = converter.convert;

  const presented = debts.map((debt) => presentDebt(debt, today));
  const projections = presented.map((debt) =>
    projectDebt(
      debt.balance,
      debt.installment,
      debt.interestRate,
      currentMonth,
    ),
  );

  // Os meses: os passados pelos movimentos, os de agora em diante projetados
  const series: {
    month: string;
    owed: number;
    lent: number;
    paid: number;
    interest: number;
    future: boolean;
  }[] = [];
  for (let index = 0; index < slots; index += 1) {
    const start = new Date(
      Date.UTC(
        firstMonth.getUTCFullYear(),
        firstMonth.getUTCMonth() + index,
        1,
      ),
    );
    const month = iso(start).slice(0, 7);
    const end = iso(
      new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)),
    );
    const point = {
      month,
      owed: 0,
      lent: 0,
      paid: 0,
      interest: 0,
      future: month > currentMonth,
    };

    debts.forEach((debt, position) => {
      const side = debt.direction === 'lent' ? 'lent' : 'owed';
      if (!point.future) {
        if (iso(debt.openingDate) > end) return;
        const day = end < today ? end : today;
        const balance = debtState(debt, day).balance;
        point[side] += convert(balance, debt.currency, day);
        if (side === 'owed')
          for (const movement of debt.movements) {
            if (movement.kind === 'charge') continue;
            if (iso(movement.date).slice(0, 7) !== month) continue;
            point.paid += convert(
              Number(movement.amount),
              debt.currency,
              iso(movement.date),
              movement.rateHour,
            );
            point.interest += convert(
              Number(movement.interestPart ?? 0),
              debt.currency,
              iso(movement.date),
              movement.rateHour,
            );
          }
        return;
      }
      // À frente: o saldo da projeção (o mês `k` depois deste é o índice k-1)
      const debtNow = presented[position];
      const ahead =
        (start.getUTCFullYear() - now.getUTCFullYear()) * 12 +
        start.getUTCMonth() -
        now.getUTCMonth();
      const projection =
        debt.status === 'active' && debtNow.installment
          ? (projections[position].balances[ahead - 1] ?? 0)
          : debtNow.balance;
      point[side] += convert(projection, debt.currency);
      if (side === 'owed' && debtNow.installment && projection > 0)
        point.paid += convert(debtNow.installment, debt.currency);
    });

    series.push(point);
  }

  // As prestações por pagar: as em atraso e as dos próximos meses
  const due = listDebtsDue(
    debts,
    dueWindowStart(now),
    new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() + DEFAULT_DUE_MONTHS + 1,
        0,
      ),
    ),
    today,
  );
  const monthEnd = iso(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)),
  );
  const dueNow = due.filter(
    (item) => item.direction === 'owe' && item.date <= monthEnd,
  );

  const owing = presented.filter(
    (debt) => debt.direction === 'owe' && debt.balance > 0,
  );
  const byKind = new Map<string, number>();
  for (const debt of owing)
    byKind.set(
      debt.kind,
      (byKind.get(debt.kind) ?? 0) + convert(debt.balance, debt.currency),
    );
  const nextPayoff = owing
    .filter((debt) => debt.projectedEnd)
    .sort((a, b) => a.projectedEnd!.localeCompare(b.projectedEnd!))[0];
  const year = today.slice(0, 4);
  const paidOf = (from: string, interestOnly: boolean) =>
    debts
      .filter((debt) => debt.direction === 'owe')
      .flatMap((debt) =>
        debt.movements
          .filter(
            (movement) =>
              movement.kind !== 'charge' && iso(movement.date) >= from,
          )
          .map((movement) =>
            convert(
              Number(
                interestOnly ? (movement.interestPart ?? 0) : movement.amount,
              ),
              debt.currency,
              iso(movement.date),
            ),
          ),
      )
      .reduce((sum, value) => sum + value, 0);

  return {
    currency: target,
    estimatedRates: converter.estimated(),
    months: series.map((point) => ({
      ...point,
      owed: round(point.owed),
      lent: round(point.lent),
      paid: round(point.paid),
      interest: round(point.interest),
    })),
    cards: {
      owed: round(
        owing.reduce(
          (sum, debt) => sum + convert(debt.balance, debt.currency),
          0,
        ),
      ),
      lent: round(
        presented
          .filter((debt) => debt.direction === 'lent')
          .reduce((sum, debt) => sum + convert(debt.balance, debt.currency), 0),
      ),
      activeCount: owing.length,
      monthlyInstallments: round(
        owing.reduce(
          (sum, debt) => sum + convert(debt.installment ?? 0, debt.currency),
          0,
        ),
      ),
      paidThisMonth: round(paidOf(`${currentMonth}-01`, false)),
      paidYear: round(paidOf(`${year}-01-01`, false)),
      interestYear: round(paidOf(`${year}-01-01`, true)),
      dueTotal: round(
        dueNow.reduce(
          (sum, item) => sum + convert(item.amount, item.currency),
          0,
        ),
      ),
      dueCount: dueNow.length,
      overdueCount: dueNow.filter((item) => item.overdue).length,
      nextPayoff: nextPayoff
        ? { name: nextPayoff.name, month: nextPayoff.projectedEnd }
        : null,
    },
    byKind: [...byKind.entries()]
      .map(([kind, total]) => ({ kind, total: round(total) }))
      .sort((a, b) => b.total - a.total),
    debts: presented
      .filter((debt) => debt.status === 'active' || debt.balance > 0)
      .map((debt) => ({
        id: debt.id,
        name: debt.name,
        kind: debt.kind,
        direction: debt.direction,
        balance: debt.balance,
        principal: debt.principal,
        paidPct: debt.paidPct,
        projectedEnd: debt.projectedEnd,
        installment: debt.installment,
        currency: debt.currency,
      })),
    upcoming: due.slice(0, UPCOMING_LIMIT),
  };
}
