import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import { assertTimesheetAccess } from './assertTimesheetAccess';

/** As ligações da empresa (sem a chave), com o que veio de cada uma e se está a sincronizar. */
export async function findTimeTrackingConnections(
  userId: string,
  companyId: string,
  repository: PrismaTimeTrackingRepository,
  companyRepository: PrismaCompanyRepository,
  isSyncing: (connectionId: string) => boolean,
) {
  await assertTimesheetAccess(userId, companyId, companyRepository, false);
  const connections = await repository.findConnections(companyId);
  return connections.map((connection) => ({ ...connection, syncing: isSyncing(connection.id) }));
}
