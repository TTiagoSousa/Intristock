import { isoDayOrNull as day } from 'src/utils/dates';
import { PrismaCompanyInvitationRepository } from '../repositories/prisma/prisma-company-invitation-repository';

const DAY_MS = 24 * 60 * 60 * 1000;
// Os pagamentos para trás que a página mostra (os por confirmar e o cruzamento dos outros)
const PAYMENTS_DAYS = 180;
const CENT = 0.005;

type Check = 'awaiting' | 'confirmed' | 'different' | 'declined';
// Sem ganho: por confirmar, ou «não recebido» se a pessoa já respondeu que não (sai dos por responder)
const check = (amount: number, income: { amount: unknown } | null, declined = false): Check =>
  !income ? (declined ? 'declined' : 'awaiting') : Math.abs(Number(income.amount) - amount) < CENT ? 'confirmed' : 'different';

/**
 * O que a pessoa tem para responder (os convites e as propostas por aceitar) e os pagamentos que
 * as empresas lhe registaram nos últimos meses, cada um cruzado com os ganhos dela: por confirmar
 * (`awaiting`), confirmado, com valores diferentes ou não recebido (`declined`, a pessoa respondeu que não).
 */
export async function findMyInvitations(userId: string, repository: PrismaCompanyInvitationRepository) {
  const since = new Date(Date.now() - PAYMENTS_DAYS * DAY_MS);
  const [invites, proposals, payments, payouts] = await Promise.all([
    repository.findInvites(userId),
    repository.findProposals(userId),
    repository.findPaymentsToUser(userId, since),
    repository.findPayoutsToUser(userId, since),
  ]);
  const declined = await repository.findDeclinedPaymentIds(
    userId,
    payments.filter(({ income }) => !income).map(({ payment }) => payment.id),
  );

  return {
    invites: invites.map((member) => ({
      id: member.id,
      company: { id: member.company.id, name: member.company.name, slug: member.company.slug },
      roleName: member.role?.name ?? null,
      invitedBy: member.invitedBy?.fullName ?? null,
      invitedAt: member.invitedAt,
    })),
    proposals: proposals.map((pay) => ({
      id: pay.id,
      company: { id: pay.member.company.id, name: pay.member.company.name, slug: pay.member.company.slug },
      kind: pay.kind,
      description: pay.description,
      grossAmount: Number(pay.grossAmount),
      currency: pay.member.currency?.shortCode ?? pay.member.company.currency.shortCode,
      paymentsPerYear: pay.paymentsPerYear,
      payDay: pay.payDay,
      startDate: day(pay.startDate),
      endDate: day(pay.endDate),
      dueDate: day(pay.dueDate),
      withholdingPct: pay.withholdingPct === null ? null : Number(pay.withholdingPct),
      previous: pay.replaces ? { grossAmount: Number(pay.replaces.grossAmount), startDate: day(pay.replaces.startDate) } : null,
      proposedBy: pay.proposedBy?.fullName ?? null,
      createdAt: pay.createdAt,
    })),
    payments: [
      ...payments.map(({ payment, income }) => ({
        source: 'company_payment' as const,
        id: payment.id,
        company: { id: payment.company.id, name: payment.company.name, slug: payment.company.slug },
        description: payment.memberPay?.description ?? payment.description,
        kind: payment.memberPay?.kind ?? null,
        period: payment.memberPayPeriod,
        date: day(payment.paymentDate)!,
        amount: Number(payment.amount),
        currency: payment.currency.shortCode,
        incomeAmount: income ? Number(income.amount) : null,
        check: check(Number(payment.amount), income, declined.has(payment.id)),
      })),
      // As horas que a empresa pagou a esta pessoa (nunca os clientes da empresa)
      ...payouts.map((payout) => ({
        source: 'time_tracking' as const,
        id: payout.id,
        company: { id: payout.company.id, name: payout.company.name, slug: payout.company.slug },
        description: null,
        kind: 'hours',
        period: null,
        seconds: payout.seconds,
        date: day(payout.paidAt)!,
        amount: Number(payout.netAmount),
        currency: payout.currency.shortCode,
        incomeAmount: payout.personalIncome ? Number(payout.personalIncome.amount) : null,
        check: check(Number(payout.netAmount), payout.personalIncome, payout.confirmation === 'declined'),
      })),
    ].sort((a, b) => b.date.localeCompare(a.date)),
  };
}
