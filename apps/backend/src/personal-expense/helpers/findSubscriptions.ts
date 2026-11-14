import { CurrencyService } from 'src/currency/currency.service';
import { expectedWindowStart } from 'src/personal-income/helpers/expectedWindowStart';
import { PrismaPersonalExpenseRepository } from '../repositories/prisma/prisma-personal-expense-repository';
import {
  ExpenseCurrency,
  SubscriptionPayment,
} from '../repositories/personal-expense-repository';
import { SubscriptionPeriodsQueryDto } from '../dto/subscription.dto';
import { listSubscriptionPeriods } from './listSubscriptionPeriods';

const FALLBACK_CURRENCY = 'EUR';
const DEFAULT_MONTHS = 12;

const round = (value: number) => Math.round(value * 100) / 100;
const iso = (date: Date) => date.toISOString().slice(0, 10);

/**
 * As subscrições da pessoa e os pagamentos delas, dos 3 meses para trás aos
 * `months` à frente: cada período pago (com a despesa) ou por pagar (em atraso
 * se o dia já passou). As pausadas e canceladas só mostram os pagos. O total
 * por mês e por ano é o das ativas recorrentes, numa moeda (pela cotação de hoje).
 */
export async function findSubscriptions(
  userId: string,
  query: SubscriptionPeriodsQueryDto,
  repository: PrismaPersonalExpenseRepository,
  currencyService: CurrencyService,
) {
  const [subscriptions, payments] = await Promise.all([
    repository.findSubscriptions(userId),
    repository.findSubscriptionPayments(userId),
  ]);

  let target: ExpenseCurrency | null = query.currencyId
    ? await repository.findCurrency(query.currencyId)
    : null;
  if (!target)
    target = subscriptions[0]
      ? subscriptions[0].currency
      : await repository.findCurrencyByCode(FALLBACK_CURRENCY);
  const converter = await currencyService.converter(
    target,
    subscriptions.map((subscription) => ({ currency: subscription.currency })),
  );
  const convert = converter.convert;

  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const from = expectedWindowStart(now);
  const until = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + (query.months ?? DEFAULT_MONTHS) + 1,
      0,
    ),
  );

  const paidBy = new Map<string, SubscriptionPayment>();
  const paymentsOf = new Map<string, SubscriptionPayment[]>();
  for (const payment of payments) {
    if (!payment.subscriptionId) continue;
    paidBy.set(`${payment.subscriptionId}|${payment.period}`, payment);
    const list = paymentsOf.get(payment.subscriptionId) ?? [];
    list.push(payment);
    paymentsOf.set(payment.subscriptionId, list);
  }

  const periods: {
    subscriptionId: string;
    period: string;
    date: string;
    amount: number;
    paid: boolean;
    expenseId: string | null;
    overdue: boolean;
  }[] = [];
  let monthly = 0;

  const list = subscriptions.map((subscription) => {
    const amount = Number(subscription.amount);
    const active = subscription.status === 'active';
    for (const { period, date } of listSubscriptionPeriods(
      subscription,
      from,
      until,
    )) {
      const payment = paidBy.get(`${subscription.id}|${period}`);
      if (!payment && !active) continue;
      periods.push({
        subscriptionId: subscription.id,
        period,
        date: iso(payment?.date ?? date),
        amount: round(payment ? Number(payment.amount) : amount),
        paid: !!payment,
        expenseId: payment?.id ?? null,
        overdue: !payment && date < today,
      });
    }

    // O que custa por mês (uma anual conta a 1/12); a não recorrente não entra
    const perMonth = subscription.recurring
      ? amount / Math.max(1, subscription.intervalMonths)
      : null;
    const ended = subscription.endDate && subscription.endDate < today;
    if (active && perMonth !== null && !ended)
      monthly += convert(perMonth, subscription.currency);

    // O próximo por pagar daqui em diante (os em atraso estão na lista)
    const next = active
      ? listSubscriptionPeriods(
          subscription,
          today,
          new Date(Date.UTC(today.getUTCFullYear() + 3, 11, 31)),
        ).find(({ period }) => !paidBy.has(`${subscription.id}|${period}`))
      : undefined;
    const paid = paymentsOf.get(subscription.id) ?? [];
    const lastPaid = paid.reduce<Date | null>(
      (last, payment) => (!last || payment.date > last ? payment.date : last),
      null,
    );

    return {
      ...subscription,
      amount,
      startDate: iso(subscription.startDate),
      endDate: subscription.endDate ? iso(subscription.endDate) : null,
      monthlyAmount: perMonth === null ? null : round(perMonth),
      nextDate: next ? iso(next.date) : null,
      lastPaidDate: lastPaid ? iso(lastPaid) : null,
      paidCount: paid.length,
      paidTotal: round(
        paid.reduce((sum, payment) => sum + Number(payment.amount), 0),
      ),
    };
  });

  periods.sort((a, b) => a.date.localeCompare(b.date));

  return {
    currency: target,
    estimatedRates: converter.estimated(),
    subscriptions: list,
    periods,
    totals: {
      monthly: round(monthly),
      yearly: round(monthly * 12),
      active: list.filter((subscription) => subscription.status === 'active')
        .length,
      overdue: periods.filter((period) => period.overdue).length,
    },
  };
}
