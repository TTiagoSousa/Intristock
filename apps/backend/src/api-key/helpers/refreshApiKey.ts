import { ApiKey } from 'src/generated/prisma/client/client';
import { decryptSecret } from 'src/utils/crypto/secret-box';
import { PrismaApiKeyRepository } from '../repositories/prisma/prisma-api-key-repository';
import { API_KEY_PROVIDERS, ApiKeyKind, ApiKeyUnusableError } from './apiKeyProviders';

/**
 * Atualiza as pesquisas de uma chave com o que a API diz agora (não gasta pesquisas). Uma
 * recusada fica com o erro; uma sem resposta fica como estava, com o erro.
 */
export async function refreshApiKey(apiKey: ApiKey, repository: PrismaApiKeyRepository) {
  const provider = API_KEY_PROVIDERS[apiKey.kind as ApiKeyKind];
  if (!provider) return apiKey;
  try {
    const { plan: _plan, ...usage } = await provider.account(decryptSecret(apiKey.key));
    return await repository.update(apiKey.id, { ...usage, checkedAt: new Date(), lastError: null });
  } catch (error) {
    const message = (error as Error).message;
    return repository.update(apiKey.id, {
      lastError: error instanceof ApiKeyUnusableError ? message : `Sem resposta: ${message}`,
      checkedAt: new Date(),
    });
  }
}
