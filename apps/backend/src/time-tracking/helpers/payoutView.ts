import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';

type Row = NonNullable<Awaited<ReturnType<PrismaTimeTrackingRepository['findPayoutView']>>>;

const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));

export type PayoutCheck = 'received' | 'awaiting' | 'different' | 'none';
const CENT = 0.005;

/**
 * Um pagamento a quem fez as horas, como o ecrã o lê, com o cruzamento com o lado da pessoa:
 * `received` (o ganho dela existe e bate), `different` (existe com outro valor), `awaiting`
 * (pago pela empresa, por confirmar) ou `none` (a pessoa não tem conta).
 */
export function payoutView(row: Row) {
  const check: PayoutCheck = row.personalIncome
    ? Math.abs(Number(row.personalIncome.amount) - Number(row.netAmount)) < CENT
      ? 'received'
      : 'different'
    : row.userId
      ? 'awaiting'
      : 'none';
  return {
    id: row.id,
    company: row.company,
    person: row.person,
    user: row.user,
    paidAt: row.paidAt.toISOString().slice(0, 10),
    seconds: row.seconds,
    hourlyRate: Number(row.hourlyRate),
    grossAmount: Number(row.grossAmount),
    withholdingPct: num(row.withholdingPct),
    netAmount: Number(row.netAmount),
    currency: row.currency,
    note: row.note,
    companyPayment: row.companyPayment
      ? { id: row.companyPayment.id, amount: Number(row.companyPayment.amount), status: row.companyPayment.status }
      : null,
    personalIncome: row.personalIncome ? { id: row.personalIncome.id, amount: Number(row.personalIncome.amount) } : null,
    check,
    // A resposta da pessoa: received | declined (nula = por responder)
    confirmation: row.confirmation,
    respondedAt: row.respondedAt,
    createdAt: row.createdAt,
  };
}
