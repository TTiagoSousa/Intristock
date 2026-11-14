import { BadRequestException } from '@nestjs/common';
import { PrismaCompanyPaymentRepository } from '../repositories/prisma/prisma-company-payment-repository';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyMemberRepository } from 'src/company-member/repositories/prisma/prisma-company-member-repository';
import { listMemberPaymentsDue } from 'src/company-member/helpers/listMemberPaymentsDue';
import {
  DEFAULT_PAYMENT_MONTHS,
  MAX_RANGE_MONTHS,
  MonthlyPaymentsQueryDto,
} from '../dto/monthly-payments-query.dto';

const round = (value: number) => Math.round(value * 100) / 100;
const monthStart = (month: string) => new Date(`${month}-01T00:00:00Z`);

/**
 * O que se pagou (`pay`) e o que se recebeu (`receive`) em cada mês, na moeda
 * da empresa: cada pagamento `amount × exchangeRate`. O intervalo é o `from`–`to`
 * escolhido, ou os últimos `months` (o atual incluído) mais `future` à frente.
 * Só os concluídos, a não ser com `includeDrafts`; as transferências internas não
 * contam. Os meses sem nada vêm a 0, para o gráfico não saltar meses.
 *
 * `plannedPay` é o que já se sabe que vem e ainda não está registado: os salários
 * e recibos verdes por pagar (`listMemberPaymentsDue`), no mês em que vencem — só
 * a quem pode ver os salários e sem filtro de fornecedor ou grupo. Noutra moeda
 * passam à da empresa pelas cotações da tabela de moedas.
 */
export async function summarizeMonthlyPayments(
  userId: string,
  companyId: string,
  query: MonthlyPaymentsQueryDto,
  companyPaymentRepository: PrismaCompanyPaymentRepository,
  companyRepository: PrismaCompanyRepository,
  memberRepository: PrismaCompanyMemberRepository,
) {
  const company = await assertCompanyAccess(
    userId,
    companyId,
    companyRepository,
    {
      notYours: 'Não podes ver os pagamentos de uma empresa que não é tua',
      permission: 'payments.view',
    },
  );

  // `paymentDate` é uma data sem hora: conta-se em UTC
  const now = new Date();
  const thisMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  let from: Date;
  let lastMonth: Date;

  if (query.from || query.to) {
    if (!query.from || !query.to)
      throw new BadRequestException('O intervalo precisa do início e do fim');
    from = monthStart(query.from);
    lastMonth = monthStart(query.to);
    if (lastMonth < from)
      throw new BadRequestException(
        'O fim do intervalo não pode ser antes do início',
      );
  } else {
    const months = query.months ?? DEFAULT_PAYMENT_MONTHS;
    from = new Date(
      Date.UTC(
        thisMonth.getUTCFullYear(),
        thisMonth.getUTCMonth() - (months - 1),
        1,
      ),
    );
    lastMonth = new Date(
      Date.UTC(
        thisMonth.getUTCFullYear(),
        thisMonth.getUTCMonth() + (query.future ?? 0),
        1,
      ),
    );
  }

  const totals = new Map<
    string,
    {
      pay: number;
      receive: number;
      payCount: number;
      receiveCount: number;
      plannedPay: number;
      plannedCount: number;
    }
  >();
  for (
    let cursor = new Date(from);
    cursor <= lastMonth;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  ) {
    if (totals.size >= MAX_RANGE_MONTHS) {
      throw new BadRequestException(
        `O intervalo não pode passar de ${MAX_RANGE_MONTHS} meses`,
      );
    }
    totals.set(cursor.toISOString().slice(0, 7), {
      pay: 0,
      receive: 0,
      payCount: 0,
      receiveCount: 0,
      plannedPay: 0,
      plannedCount: 0,
    });
  }
  const until = new Date(
    Date.UTC(lastMonth.getUTCFullYear(), lastMonth.getUTCMonth() + 1, 0),
  );

  const payments = await companyPaymentRepository.findForMonthlyTotals(
    companyId,
    {
      from,
      until,
      statuses: query.includeDrafts ? ['completed', 'draft'] : ['completed'],
      supplierId: query.supplierId,
      supplierGroupId: query.supplierGroupId,
    },
  );
  for (const payment of payments) {
    const entry = totals.get(payment.paymentDate.toISOString().slice(0, 7));
    if (!entry) continue;
    const value = Number(payment.amount) * Number(payment.exchangeRate);
    if (payment.paymentType === 'pay') {
      entry.pay += value;
      entry.payCount++;
    } else {
      entry.receive += value;
      entry.receiveCount++;
    }
  }

  // A previsão: só para quem vê os salários, e os salários não são de nenhum fornecedor
  const seesSalaries = await assertCompanyAccess(
    userId,
    companyId,
    companyRepository,
    {
      notYours: '',
      permission: 'salaries.view',
    },
  ).then(
    () => true,
    () => false,
  );

  if (seesSalaries && !query.supplierId && !query.supplierGroupId) {
    const pays = await memberRepository.findCompanyPays(companyId);
    const paid = await memberRepository.findPaidPeriods(
      pays.map((pay) => pay.id),
    );
    const companyCurrency = await memberRepository.findCurrency(
      company.currencyId,
    );
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    for (const due of listMemberPaymentsDue(
      pays,
      paid,
      from,
      until,
      today,
      companyCurrency,
    )) {
      const entry = totals.get(due.date.slice(0, 7));
      if (!entry) continue;
      const value = due.kind === 'freelance' ? due.netAmount : due.grossAmount;
      // Pelas cotações da tabela (unidades por dólar): moeda → dólar → moeda da empresa
      const rate =
        due.currency &&
        companyCurrency &&
        due.currency.id !== companyCurrency.id &&
        due.currency.rate
          ? companyCurrency.rate / due.currency.rate
          : 1;
      entry.plannedPay += value * rate;
      entry.plannedCount++;
    }
  }

  return [...totals].map(([month, entry]) => ({
    month,
    pay: round(entry.pay),
    receive: round(entry.receive),
    payCount: entry.payCount,
    receiveCount: entry.receiveCount,
    plannedPay: round(entry.plannedPay),
    plannedCount: entry.plannedCount,
    // Os meses depois do atual: só previsão e o que já está marcado para lá
    future: monthStart(month) > thisMonth,
  }));
}
