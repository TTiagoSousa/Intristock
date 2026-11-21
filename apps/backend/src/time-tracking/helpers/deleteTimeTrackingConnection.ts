import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import { assertTimesheetAccess } from './assertTimesheetAccess';

/**
 * Apaga a ligação e o que veio dela (clientes, projetos, pessoas e registos). Com horas pagas
 * (pelo cliente ou a quem as fez) não se apaga: os pagamentos ficavam sem as horas — pausa-se.
 */
export async function deleteTimeTrackingConnection(
  userId: string,
  companyId: string,
  connectionId: string,
  repository: PrismaTimeTrackingRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertTimesheetAccess(userId, companyId, companyRepository, true);
  const connection = await repository.findConnection(connectionId);
  if (!connection || connection.companyId !== companyId) throw new NotFoundException('Ligação não encontrada');
  // As horas pagas pelo cliente (liquidações) e as pagas a quem as fez (payouts, que apontam para
  // as pessoas da ligação) não se perdem
  const [settlements, payouts] = await Promise.all([
    repository.countConnectionSettlements(connectionId),
    repository.countConnectionPayouts(connectionId),
  ]);
  if (settlements || payouts) throw new ConflictException('Esta ligação tem horas pagas: não se apaga, pausa-a');
  await repository.deleteConnection(connectionId);
  return { deleted: true };
}
