import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { CheckTimeTrackingDto } from '../dto/time-tracking.dto';
import { assertTimesheetAccess } from './assertTimesheetAccess';
import { checkSolidtimeToken } from './checkSolidtimeToken';
import { normalizeBaseUrl } from './normalizeBaseUrl';

/** O primeiro passo de uma ligação: valida o endereço e a chave e devolve as organizações (nada se grava). */
export async function checkTimeTrackingConnection(
  userId: string,
  companyId: string,
  dto: CheckTimeTrackingDto,
  companyRepository: PrismaCompanyRepository,
) {
  await assertTimesheetAccess(userId, companyId, companyRepository, true);
  const baseUrl = normalizeBaseUrl(dto.baseUrl);
  const result = await checkSolidtimeToken({ baseUrl, token: dto.token.trim() });
  return { baseUrl, ...result };
}
