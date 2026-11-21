import { NotFoundException } from '@nestjs/common';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import { assertTimesheetAccess } from './assertTimesheetAccess';

/** Para sincronizar já: a ligação tem de ser desta empresa e quem pede tem de poder gerir. */
export async function assertConnectionOfCompany(
  userId: string,
  companyId: string,
  connectionId: string,
  repository: PrismaTimeTrackingRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertTimesheetAccess(userId, companyId, companyRepository, true);
  const connection = await repository.findConnectionView(companyId, connectionId);
  if (!connection) throw new NotFoundException('Ligação não encontrada');
  return connection;
}
