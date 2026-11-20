import { BadRequestException } from '@nestjs/common';
import { encryptSecret } from 'src/utils/crypto/secret-box';
import { PrismaApiKeyRepository } from '../repositories/prisma/prisma-api-key-repository';
import { CreateApiKeyDto } from '../dto/api-key.dto';
import { API_KEY_PROVIDERS, ApiKeyUnusableError } from './apiKeyProviders';

/**
 * Junta uma chave a uma API: pergunta-lhe pela conta (não gasta pesquisas), recusa uma que
 * ela não aceite e grava-a cifrada no fim da fila, já com as pesquisas do mês.
 */
export async function addApiKey(dto: CreateApiKeyDto, repository: PrismaApiKeyRepository) {
  const key = dto.key.trim();
  const provider = API_KEY_PROVIDERS[dto.kind];
  let account: Awaited<ReturnType<typeof provider.account>>;
  try {
    account = await provider.account(key);
  } catch (error) {
    throw new BadRequestException(
      error instanceof ApiKeyUnusableError ? error.message : `Não deu para validar a chave: ${(error as Error).message}`,
    );
  }
  const { plan, ...usage } = account;
  const created = await repository.create({
    kind: dto.kind,
    label: dto.label?.trim() || plan,
    key: encryptSecret(key),
    keyHint: key.slice(-4),
    ...usage,
    checkedAt: new Date(),
    lastError: null,
  });
  const { key: _secret, ...view } = created;
  return view;
}
