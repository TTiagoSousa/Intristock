import { BadRequestException, NotFoundException } from '@nestjs/common';
import { encryptSecret, secretContext } from 'src/utils/crypto/secret-box';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';
import { UpdateTimeTrackingConnectionDto } from '../dto/time-tracking.dto';
import { assertTimesheetAccess } from './assertTimesheetAccess';
import { checkSolidtimeToken } from './checkSolidtimeToken';

/**
 * Pausa ou retoma, muda o intervalo ou troca a chave (validada: tem de ter acesso à mesma
 * organização). Retomar ou trocar a chave limpa o erro.
 */
export async function updateTimeTrackingConnection(
  userId: string,
  companyId: string,
  connectionId: string,
  dto: UpdateTimeTrackingConnectionDto,
  repository: PrismaTimeTrackingRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertTimesheetAccess(userId, companyId, companyRepository, true);
  const connection = await repository.findConnection(connectionId);
  if (!connection || connection.companyId !== companyId) throw new NotFoundException('Ligação não encontrada');

  const data: Parameters<PrismaTimeTrackingRepository['updateConnection']>[1] = {};
  if (dto.token !== undefined) {
    const token = dto.token.trim();
    const { organizations } = await checkSolidtimeToken({ baseUrl: connection.baseUrl, token });
    if (!organizations.some((row) => row.id === connection.organizationId))
      throw new BadRequestException('A chave nova não tem acesso à organização desta ligação');
    data.apiToken = encryptSecret(token, secretContext('time_tracking_connection', companyId, 'apiToken'));
    data.lastError = null;
    if (connection.status === 'error') data.status = 'active';
  }
  if (dto.paused !== undefined) {
    data.status = dto.paused ? 'paused' : 'active';
    if (!dto.paused) data.lastError = null;
  }
  if (dto.syncEveryHours !== undefined) data.syncEveryHours = dto.syncEveryHours;

  await repository.updateConnection(connectionId, data);
  return (await repository.findConnectionView(companyId, connectionId))!;
}
