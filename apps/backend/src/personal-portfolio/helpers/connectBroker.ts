import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { encryptSecret } from 'src/utils/crypto/secret-box';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';
import { ConnectBrokerDto } from '../dto/personal-portfolio.dto';
import { fetchTrading212Account, Trading212Error } from './trading212Client';
import { ensureCashPortfolio } from './syncTrading212';

// A plataforma no catálogo (systemCatalog)
export const TRADING212_PLATFORM = 'Trading 212';

/** Valida a chave na corretora e devolve a conta dela; uma chave recusada é um 400. */
export async function checkTrading212Key(apiKey: string, apiSecret: string) {
  try {
    return await fetchTrading212Account({ apiKey, apiSecret });
  } catch (error) {
    if (error instanceof Trading212Error) throw new BadRequestException(error.message);
    throw new BadRequestException('Sem resposta da Trading 212');
  }
}

/**
 * Liga uma conta da Trading 212 à pessoa: valida a chave, guarda-a cifrada e cria o
 * portefólio do dinheiro (só de leitura). A primeira sincronização (o histórico
 * todo, cerca de um minuto) corre a seguir, em fundo.
 */
export async function connectBroker(
  userId: string,
  dto: ConnectBrokerDto,
  repository: PrismaPersonalPortfolioRepository,
) {
  const platform = await repository.findBrokerPlatform(TRADING212_PLATFORM);
  if (!platform)
    throw new NotFoundException('A Trading 212 ainda não está nas plataformas');

  const apiKey = dto.apiKey.trim();
  const apiSecret = dto.apiSecret.trim();
  const account = await checkTrading212Key(apiKey, apiSecret);
  if (await repository.findConnectionByAccount(userId, platform.id, account.id))
    throw new ConflictException('Essa conta da Trading 212 já está ligada');

  const connection = await repository.createConnection({
    userId,
    platformId: platform.id,
    externalAccountId: account.id,
    currencyCode: account.currency ?? null,
    apiKey: encryptSecret(apiKey),
    apiSecret: encryptSecret(apiSecret),
    fromDate: dto.fromDate ? new Date(dto.fromDate) : null,
  });
  // Sem o portefólio a ligação não fica (senão a conta ficava "já ligada" e sem nada)
  try {
    await ensureCashPortfolio(connection, account.currency ?? 'EUR', repository);
  } catch (error) {
    await repository.deleteConnection(connection.id).catch(() => undefined);
    throw error;
  }
  return (await repository.findConnectionView(userId, connection.id))!;
}
