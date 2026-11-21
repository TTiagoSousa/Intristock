import { isoDay as day } from 'src/utils/dates';
import { pickDisplayCurrency } from 'src/currency/helpers/pickDisplayCurrency';
import { CurrencyService } from 'src/currency/currency.service';
import { BadRequestException } from '@nestjs/common';
import { PrismaPersonalIncomeRepository } from '../repositories/prisma/prisma-personal-income-repository';
import { IncomeCurrency } from '../repositories/personal-income-repository';
import {
  DEFAULT_SUMMARY_FUTURE,
  DEFAULT_SUMMARY_MONTHS,
  IncomeSummaryQueryDto,
  MAX_SUMMARY_RANGE_MONTHS,
} from '../dto/income-query.dto';
import { expectedWindowStart } from './expectedWindowStart';
import { PrismaTimeTrackingRepository } from 'src/time-tracking/repositories/prisma/prisma-time-tracking-repository';
import { findExpectedIncomes } from './findExpectedIncomes';
import { findIncomes } from './findIncomes';

// Quantos por receber vão na lista do dashboard
const UPCOMING_LIMIT = 8;

const round = (value: number) => Math.round(value * 100) / 100;
const monthOf = (date: Date) => date.toISOString().slice(0, 7);

/**
 * O dashboard dos ganhos, tudo numa moeda (a escolhida, ou a mais usada; as
 * outras pela cotação do dia de cada ganho; os por receber à frente, pela de hoje): cada mês dos últimos `months` e
 * dos `future` à frente com o recebido e o por receber (os ganhos pendentes e os
 * salários esperados ainda não registados), o recebido por tipo e por fonte, os
 * cartões e os próximos por receber. Com `from`–`to` (meses), o gráfico e as somas
 * por tipo e por fonte são desse intervalo; os cartões e os próximos não mudam.
 */
export async function summarizeIncomes(
  userId: string,
  query: IncomeSummaryQueryDto,
  repository: PrismaPersonalIncomeRepository,
  currencyService: CurrencyService,
  timeTracking?: PrismaTimeTrackingRepository,
) {
  const months = query.months ?? DEFAULT_SUMMARY_MONTHS;
  const future = query.future ?? DEFAULT_SUMMARY_FUTURE;
  const now = new Date();
  const currentMonth = monthOf(now);
  const firstMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1),
  );
  const until = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + future + 1, 0),
  );

  // O gráfico e as somas por tipo e por fonte: o intervalo escolhido à mão, ou o dos cartões
  let rangeStart = firstMonth;
  let rangeEnd = until;
  if (query.from || query.to) {
    if (!query.from || !query.to)
      throw new BadRequestException('O intervalo precisa do início e do fim');
    const [fromYear, fromMonth] = query.from.split('-').map(Number);
    const [toYear, toMonth] = query.to.split('-').map(Number);
    rangeStart = new Date(Date.UTC(fromYear, fromMonth - 1, 1));
    rangeEnd = new Date(Date.UTC(toYear, toMonth, 0));
    if (rangeEnd < rangeStart)
      throw new BadRequestException(
        'O fim do intervalo não pode ser antes do início',
      );
    if (
      (toYear - fromYear) * 12 + toMonth - fromMonth + 1 >
      MAX_SUMMARY_RANGE_MONTHS
    )
      throw new BadRequestException(
        `O intervalo não pode ter mais de ${MAX_SUMMARY_RANGE_MONTHS} meses`,
      );
  }
  const cardFrom = day(firstMonth);
  const cardTo = day(until);
  const inRange = (date: string) =>
    date >= day(rangeStart) && date <= day(rangeEnd);
  const inCards = (date: string) => date >= cardFrom && date <= cardTo;

  // Vai-se buscar o que cobre os dois
  const spanStart = rangeStart < firstMonth ? rangeStart : firstMonth;
  const spanEnd = rangeEnd > until ? rangeEnd : until;
  const recorded = await findIncomes(
    userId,
    { from: day(spanStart), to: day(spanEnd) },
    repository,
  );
  // Os esperados só dos últimos meses para cá, como no registo
  const windowStart = expectedWindowStart(now);
  const expected = await findExpectedIncomes(
    userId,
    windowStart > spanStart ? windowStart : spanStart,
    spanEnd,
    repository,
    timeTracking,
  );

  // A moeda: a pedida, senão a dos ganhos mais usada, senão o euro
  const target: IncomeCurrency | null = await pickDisplayCurrency(
    query.currencyId,
    recorded.map((income) => income.currencyId),
    repository,
  );
  const converter = await currencyService.converter(target, [
    ...recorded.map((income) => ({
      currency: income.currency,
      day: income.date,
      hour: income.rateHour,
    })),
    ...expected.map((income) => ({
      currency: income.currency,
      day: income.date,
    })),
  ]);
  const convert = converter.convert;

  // Os meses, com os vazios a 0
  const monthly = new Map<
    string,
    { month: string; received: number; pending: number; future: boolean }
  >();
  for (
    let cursor = new Date(rangeStart);
    cursor <= rangeEnd;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  ) {
    const month = monthOf(cursor);
    monthly.set(month, {
      month,
      received: 0,
      pending: 0,
      future: month > currentMonth,
    });
  }

  const byKind = new Map<string, number>();
  const bySource = new Map<
    string,
    {
      key: string;
      name: string | null;
      kind: string;
      total: number;
      count: number;
    }
  >();
  const pending: {
    id: string | null;
    origin: 'record' | 'source' | 'company' | 'time_tracking';
    name: string | null;
    kind: string;
    part: string | null;
    period: string | null;
    date: string;
    overdue: boolean;
    amount: number;
    currency: IncomeCurrency;
    companyPaid: boolean;
    // A empresa da linha (nas horas, quem paga) e, se já pagou e falta confirmar, o pagamento
    company?: { id: string; name: string; slug: string } | null;
    payoutId?: string;
  }[] = [];
  const today = now.toISOString().slice(0, 10);
  let received = 0;
  let receivedYear = 0;
  let receivedThisMonth = 0;

  for (const income of recorded) {
    const value = convert(
      income.amount,
      income.currency,
      income.date,
      income.rateHour,
    );
    const slot = monthly.get(income.date.slice(0, 7));
    if (income.status === 'pending') {
      if (slot) slot.pending += value;
      // Os em atraso contam sempre, mesmo de antes dos meses dos cartões
      if (!inCards(income.date) && income.date >= today) continue;
      pending.push({
        id: income.id,
        origin: 'record',
        name: income.source?.name ?? income.company?.name ?? income.description,
        kind: income.kind,
        part: null,
        period: income.period,
        date: income.date,
        overdue: income.date < today,
        amount: income.amount,
        currency: income.currency,
        companyPaid: false,
      });
      continue;
    }
    if (income.date > today) continue;
    if (slot) slot.received += value;
    if (inCards(income.date)) {
      received += value;
      if (income.date.slice(0, 4) === today.slice(0, 4)) receivedYear += value;
      if (income.date.slice(0, 7) === currentMonth) receivedThisMonth += value;
    }
    if (!inRange(income.date)) continue;
    byKind.set(income.kind, (byKind.get(income.kind) ?? 0) + value);

    // Por fonte: a fonte, ou a empresa que paga, ou "sem fonte"
    const key = income.source?.id ?? income.company?.id ?? 'none';
    const group = bySource.get(key) ?? {
      key,
      name: income.source?.name ?? income.company?.name ?? null,
      kind: income.source?.kind ?? (income.company ? 'company' : 'none'),
      total: 0,
      count: 0,
    };
    group.total += value;
    group.count += 1;
    bySource.set(key, group);
  }

  for (const income of expected) {
    const slot = monthly.get(income.date.slice(0, 7));
    if (slot)
      slot.pending += convert(income.amount, income.currency, income.date);
    if (!inCards(income.date) && !income.overdue) continue;
    pending.push({
      id: null,
      origin: income.origin,
      name: income.name,
      kind: income.kind,
      part: income.part,
      period: income.period,
      date: income.date,
      overdue: income.overdue,
      amount: income.amount,
      currency: income.currency,
      companyPaid: income.companyPaid,
      company: income.company,
      ...(income.payoutId ? { payoutId: income.payoutId } : {}),
    });
  }
  pending.sort((a, b) => a.date.localeCompare(b.date));

  const pendingTotal = pending.reduce(
    (sum, item) => sum + convert(item.amount, item.currency, item.date),
    0,
  );

  return {
    currency: target,
    estimatedRates: converter.estimated(),
    months: [...monthly.values()].map((month) => ({
      ...month,
      received: round(month.received),
      pending: round(month.pending),
    })),
    cards: {
      received: round(received),
      receivedYear: round(receivedYear),
      receivedThisMonth: round(receivedThisMonth),
      // Os cartões contam os últimos `months`, o atual incluído
      monthlyAverage: round(received / months),
      pending: round(pendingTotal),
      pendingCount: pending.length,
      overdueCount: pending.filter((item) => item.overdue).length,
    },
    byKind: [...byKind.entries()]
      .map(([kind, total]) => ({ kind, total: round(total) }))
      .sort((a, b) => b.total - a.total),
    bySource: [...bySource.values()]
      .map((group) => ({ ...group, total: round(group.total) }))
      .sort((a, b) => b.total - a.total),
    upcoming: pending.slice(0, UPCOMING_LIMIT),
  };
}
