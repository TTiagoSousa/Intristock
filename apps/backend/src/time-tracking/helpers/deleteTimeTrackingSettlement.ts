import { NotFoundException } from '@nestjs/common';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import { assertTimesheetAccess } from './assertTimesheetAccess';
import { SettlementPayments } from './createTimeTrackingSettlement';

/**
 * Desfaz uma liquidação: as horas voltam a estar por pagar (as alocações saem com ela) e o
 * recebimento na empresa apaga-se (com as permissões dele). Não mexe nas finanças pessoais.
 */
export async function deleteTimeTrackingSettlement(
  userId: string,
  companyId: string,
  settlementId: string,
  repository: PrismaTimeTrackingRepository,
  companyRepository: PrismaCompanyRepository,
  payments: SettlementPayments,
) {
  await assertTimesheetAccess(userId, companyId, companyRepository, true);
  const settlement = await repository.findSettlement(companyId, settlementId);
  if (!settlement) throw new NotFoundException('Pagamento não encontrado');
  if (settlement.companyPaymentId) await payments.remove(userId, companyId, settlement.companyPaymentId);
  await repository.deleteSettlement(settlement.id);
  return { id: settlement.id };
}
