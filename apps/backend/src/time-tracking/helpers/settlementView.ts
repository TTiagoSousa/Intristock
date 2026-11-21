import { isoDayOrNull as day } from 'src/utils/dates';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';

type Row = NonNullable<Awaited<ReturnType<PrismaTimeTrackingRepository['findSettlementView']>>>;

const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));

/** Uma liquidação (o cliente pagou à empresa) como o ecrã a lê: os números, as horas alocadas e as adiantadas. */
export function settlementView(row: Row) {
  const allocatedSeconds = row.allocations.reduce((sum, allocation) => sum + allocation.seconds, 0);
  return {
    id: row.id,
    mode: row.mode,
    company: row.company,
    client: row.client,
    person: row.person,
    fromDate: day(row.fromDate),
    toDate: day(row.toDate),
    paidAt: day(row.paidAt)!,
    seconds: row.seconds,
    allocatedSeconds,
    creditSeconds: Math.max(0, row.seconds - allocatedSeconds),
    hourlyRate: Number(row.hourlyRate),
    grossAmount: Number(row.grossAmount),
    withholdingPct: num(row.withholdingPct),
    netAmount: Number(row.netAmount),
    currency: row.currency,
    note: row.note,
    companyPayment: row.companyPayment
      ? { id: row.companyPayment.id, amount: Number(row.companyPayment.amount), status: row.companyPayment.status }
      : null,
    createdAt: row.createdAt,
  };
}
