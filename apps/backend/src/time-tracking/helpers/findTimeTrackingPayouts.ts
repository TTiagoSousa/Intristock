import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import { PayoutsQueryDto } from '../dto/time-tracking.dto';
import { assertTimesheetAccess } from './assertTimesheetAccess';
import { payoutView } from './payoutView';

/** O que a empresa pagou a quem fez as horas, do mais recente, com o cruzamento com a pessoa. */
export async function findTimeTrackingPayouts(
  userId: string,
  companyId: string,
  query: PayoutsQueryDto,
  repository: PrismaTimeTrackingRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertTimesheetAccess(userId, companyId, companyRepository, false);
  return (await repository.findPayoutsList(companyId, query)).map(payoutView);
}
