import { NotFoundException } from '@nestjs/common';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import { assertTimesheetAccess } from './assertTimesheetAccess';
import { SettlementPayments } from './createTimeTrackingSettlement';

/**
 * Desfaz um pagamento a quem fez as horas: as horas voltam a estar por pagar à pessoa, o
 * pagamento na empresa apaga-se (com as permissões dele) e o ganho pessoal também, se for de
 * quem desfaz. O ganho já confirmado por outra pessoa fica com ela: é o registo dela.
 */
export async function deleteTimeTrackingPayout(
  userId: string,
  companyId: string,
  payoutId: string,
  repository: PrismaTimeTrackingRepository,
  companyRepository: PrismaCompanyRepository,
  payments: SettlementPayments,
) {
  await assertTimesheetAccess(userId, companyId, companyRepository, true);
  const payout = await repository.findPayout(companyId, payoutId);
  if (!payout) throw new NotFoundException('Pagamento não encontrado');
  if (payout.companyPaymentId) await payments.remove(userId, companyId, payout.companyPaymentId);
  await repository.deletePayout(payout.id);
  if (payout.personalIncome && payout.personalIncome.userId === userId)
    await repository.deletePersonalIncome(payout.personalIncome.id);
  return { id: payout.id };
}
