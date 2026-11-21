import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import { TimeTrackingSummaryQueryDto } from '../dto/time-tracking.dto';
import { assertTimesheetAccess } from './assertTimesheetAccess';
import { entryValue } from './entryValue';
import { localDay, resolveTimezone } from './localDay';

const round = (value: number) => Math.round(value * 100) / 100;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Os meses de `first` a `last` (YYYY-MM), inclusive. */
const monthsBetween = (first: string, last: string) => {
  const list: string[] = [];
  const cursor = new Date(`${first}-01T00:00:00Z`);
  while (cursor.toISOString().slice(0, 7) <= last) {
    list.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return list;
};

/**
 * A visão geral do banco de horas: os cartões (horas e valor deste mês e do anterior, o
 * recebido no período e o que falta receber de sempre), o valor de cada mês por cliente
 * (pago e por pagar), as somas por cliente no período e os últimos pagamentos.
 */
export async function summarizeTimeTracking(
  userId: string,
  companyId: string,
  query: TimeTrackingSummaryQueryDto,
  repository: PrismaTimeTrackingRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertTimesheetAccess(userId, companyId, companyRepository, false);
  const timeZone = resolveTimezone(query.tz);
  const months = query.months ?? 12;
  const now = new Date();
  const currentMonth = localDay(now, timeZone).slice(0, 7);
  const firstDate = new Date(`${currentMonth}-01T00:00:00Z`);
  firstDate.setUTCMonth(firstDate.getUTCMonth() - (months - 1));
  const firstMonth = firstDate.toISOString().slice(0, 7);
  const previousDate = new Date(`${currentMonth}-01T00:00:00Z`);
  previousDate.setUTCMonth(previousDate.getUTCMonth() - 1);
  const previousMonth = previousDate.toISOString().slice(0, 7);

  const [connections, entries, settlements] = await Promise.all([
    repository.findConnections(companyId),
    // Todos: o por receber é de sempre, não só do período
    repository.findEntries({ companyId }),
    repository.findSettlements(companyId, new Date(firstDate.getTime() - DAY_MS)),
  ]);

  const monthly = new Map(
    monthsBetween(firstMonth, currentMonth).map((month) => [
      month,
      { month, seconds: 0, amount: 0, paid: 0, unpaid: 0, byClient: {} as Record<string, number> },
    ]),
  );
  const byClient = new Map<string, { id: string | null; name: string | null; seconds: number; amount: number; unpaid: number }>();
  const cards = {
    secondsThisMonth: 0,
    secondsPreviousMonth: 0,
    amountThisMonth: 0,
    amountPreviousMonth: 0,
    amountPeriod: 0,
    received: 0,
    receivedGross: 0,
    receivedThisMonth: 0,
    pending: 0,
    pendingSeconds: 0,
    pendingClients: 0,
  };
  const pendingClients = new Set<string>();

  for (const entry of entries) {
    const value = entryValue(entry);
    const month = localDay(entry.start, timeZone).slice(0, 7);
    if (value.unpaidAmount > 0) {
      cards.pending += value.unpaidAmount;
      cards.pendingSeconds += value.unpaidSeconds;
      pendingClients.add(entry.clientId ?? 'none');
    }
    if (month === currentMonth) {
      cards.secondsThisMonth += value.seconds;
      cards.amountThisMonth += value.amount;
    } else if (month === previousMonth) {
      cards.secondsPreviousMonth += value.seconds;
      cards.amountPreviousMonth += value.amount;
    }
    const slot = monthly.get(month);
    if (!slot) continue;
    cards.amountPeriod += value.amount;
    slot.seconds += value.seconds;
    slot.amount += value.amount;
    slot.paid += value.paidAmount;
    slot.unpaid += value.unpaidAmount;
    const key = entry.clientId ?? 'none';
    slot.byClient[key] = (slot.byClient[key] ?? 0) + value.amount;
    const client = byClient.get(key) ?? {
      id: entry.client?.id ?? null,
      name: entry.client?.name ?? null,
      seconds: 0,
      amount: 0,
      unpaid: 0,
    };
    client.seconds += value.seconds;
    client.amount += value.amount;
    client.unpaid += value.unpaidAmount;
    byClient.set(key, client);
  }
  cards.pendingClients = pendingClients.size;

  for (const settlement of settlements) {
    const paidMonth = settlement.paidAt.toISOString().slice(0, 7);
    if (paidMonth < firstMonth) continue;
    cards.received += Number(settlement.netAmount);
    cards.receivedGross += Number(settlement.grossAmount);
    if (paidMonth === currentMonth) cards.receivedThisMonth += Number(settlement.netAmount);
  }

  const roundCards = Object.fromEntries(
    Object.entries(cards).map(([key, value]) => [key, key.toLowerCase().includes('seconds') || key === 'pendingClients' ? value : round(value)]),
  ) as typeof cards;

  return {
    currency: connections[0]?.currency ?? null,
    connections: connections.length,
    months: [...monthly.values()].map((slot) => ({
      ...slot,
      amount: round(slot.amount),
      paid: round(slot.paid),
      unpaid: round(slot.unpaid),
      byClient: Object.fromEntries(Object.entries(slot.byClient).map(([key, value]) => [key, round(value)])),
    })),
    cards: roundCards,
    byClient: [...byClient.entries()]
      .map(([key, client]) => ({ key, ...client, amount: round(client.amount), unpaid: round(client.unpaid) }))
      .sort((a, b) => b.amount - a.amount || b.seconds - a.seconds),
    settlements: settlements.slice(0, 8).map((settlement) => ({
      id: settlement.id,
      client: settlement.client,
      paidAt: settlement.paidAt.toISOString().slice(0, 10),
      seconds: settlement.seconds,
      grossAmount: Number(settlement.grossAmount),
      netAmount: Number(settlement.netAmount),
      recorded: Boolean(settlement.companyPaymentId),
    })),
  };
}
