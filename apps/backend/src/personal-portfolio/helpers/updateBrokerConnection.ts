import { BadRequestException, NotFoundException } from '@nestjs/common';
import { encryptSecret } from 'src/utils/crypto/secret-box';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';
import { UpdateBrokerConnectionDto } from '../dto/personal-portfolio.dto';
import { checkTrading212Key } from './connectBroker';

/**
 * Muda uma ligação: a chave nova (validada, e tem de ser da mesma conta), o dia a
 * partir do qual se vê (nulo = tudo), a pausa e o intervalo da sincronização automática. Não mexe no que já foi importado.
 */
export async function updateBrokerConnection(
  userId: string,
  connectionId: string,
  dto: UpdateBrokerConnectionDto,
  repository: PrismaPersonalPortfolioRepository,
) {
  const current = await repository.findConnectionView(userId, connectionId);
  if (!current) throw new NotFoundException('Ligação não encontrada');

  const data: Parameters<PrismaPersonalPortfolioRepository['updateConnection']>[1] = {};
  if (dto.apiKey !== undefined || dto.apiSecret !== undefined) {
    if (!dto.apiKey?.trim() || !dto.apiSecret?.trim())
      throw new BadRequestException('A chave e o segredo vão juntos');
    const account = await checkTrading212Key(dto.apiKey.trim(), dto.apiSecret.trim());
    if (account.id !== current.externalAccountId)
      throw new BadRequestException('Essa chave é de outra conta da Trading 212');
    data.apiKey = encryptSecret(dto.apiKey.trim());
    data.apiSecret = encryptSecret(dto.apiSecret.trim());
    if (current.status === 'error') {
      data.status = 'active';
      data.lastError = null;
    }
  }
  if (dto.fromDate !== undefined) data.fromDate = dto.fromDate ? new Date(dto.fromDate) : null;
  if (dto.paused !== undefined) data.status = dto.paused ? 'paused' : 'active';
  if (dto.syncEveryHours !== undefined) data.syncEveryHours = dto.syncEveryHours;

  await repository.updateConnection(connectionId, data);
  return (await repository.findConnectionView(userId, connectionId))!;
}
