import { BadRequestException, ConflictException } from '@nestjs/common';
import { encryptSecret, secretContext } from 'src/utils/crypto/secret-box';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import { CreateTimeTrackingConnectionDto } from '../dto/time-tracking.dto';
import { assertTimesheetAccess } from './assertTimesheetAccess';
import { checkSolidtimeToken } from './checkSolidtimeToken';
import { normalizeBaseUrl } from './normalizeBaseUrl';

/**
 * Liga a empresa a uma organização do solidtime: valida a chave, confirma que ela tem acesso
 * à organização e guarda-a cifrada. A ligação é da empresa (quem a criou fica só registado).
 * A primeira sincronização corre a seguir, em fundo.
 */
export async function createTimeTrackingConnection(
  userId: string,
  companyId: string,
  dto: CreateTimeTrackingConnectionDto,
  repository: PrismaTimeTrackingRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertTimesheetAccess(userId, companyId, companyRepository, true);
  const baseUrl = normalizeBaseUrl(dto.baseUrl);
  const token = dto.token.trim();
  const { organizations } = await checkSolidtimeToken({ baseUrl, token });
  const organization = organizations.find((row) => row.id === dto.organizationId);
  if (!organization) throw new BadRequestException('A chave não tem acesso a essa organização');
  if (await repository.findConnectionByOrganization(companyId, dto.provider, baseUrl, organization.id))
    throw new ConflictException('Essa organização já está ligada a esta empresa');

  const currency = await repository.findCurrencyByCode(organization.currency || 'EUR');
  if (!currency) throw new BadRequestException(`A moeda ${organization.currency} não existe no IntriStock`);

  const connection = await repository.createConnection({
    companyId,
    provider: dto.provider,
    baseUrl,
    apiToken: encryptSecret(token, secretContext('time_tracking_connection', companyId, 'apiToken')),
    organizationId: organization.id,
    organizationName: organization.name,
    currencyId: currency.id,
    syncEveryHours: dto.syncEveryHours ?? 1,
    createdById: userId,
  });
  return (await repository.findConnectionView(companyId, connection.id))!;
}
