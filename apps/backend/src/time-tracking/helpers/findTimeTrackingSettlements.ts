import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import { SettlementsQueryDto } from '../dto/time-tracking.dto';
import { assertTimesheetAccess } from './assertTimesheetAccess';
import { settlementView } from './settlementView';

/** As liquidações da empresa (as horas marcadas como pagas), da mais recente, com o cruzamento. */
export async function findTimeTrackingSettlements(
  userId: string,
  companyId: string,
  query: SettlementsQueryDto,
  repository: PrismaTimeTrackingRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertTimesheetAccess(userId, companyId, companyRepository, false);
  const rows = await repository.findSettlementsList(companyId, query);
  return rows.map(settlementView);
}
