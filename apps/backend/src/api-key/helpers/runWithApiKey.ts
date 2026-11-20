import { BadRequestException } from '@nestjs/common';
import { decryptSecret } from 'src/utils/crypto/secret-box';
import { PrismaApiKeyRepository } from '../repositories/prisma/prisma-api-key-repository';
import { ApiKeyKind, ApiKeyUnusableError, nextMonth } from './apiKeyProviders';
import { refreshApiKey } from './refreshApiKey';

/**
 * Corre um pedido com a primeira chave que se pode usar. Se a API disser que ela esgotou as
 * pesquisas, fica parada até ao mês seguinte; se a recusar, fica com o erro — e tenta-se a
 * seguinte. Sem nenhuma que sirva, recusa. Depois de um pedido, as pesquisas da chave
 * atualizam-se com o que a API diz (em fundo).
 */
export async function runWithApiKey<T>(
  kind: ApiKeyKind,
  run: (key: string) => Promise<T>,
  repository: PrismaApiKeyRepository,
): Promise<T> {
  const keys = await repository.findUsable(kind, new Date());
  if (!keys.length)
    throw new BadRequestException(
      'Não há nenhuma chave da SerpApi com pesquisas este mês — o administrador junta uma em Definições → APIs',
    );

  const failures: string[] = [];
  for (const apiKey of keys) {
    try {
      const result = await run(decryptSecret(apiKey.key));
      const used = await repository.update(apiKey.id, { lastUsedAt: new Date(), lastError: null });
      void refreshApiKey(used, repository).catch(() => undefined);
      return result;
    } catch (error) {
      if (!(error instanceof ApiKeyUnusableError)) throw error;
      failures.push(`${apiKey.label ?? `…${apiKey.keyHint}`}: ${error.message}`);
      await repository.update(
        apiKey.id,
        error.reason === 'exhausted'
          ? { exhaustedUntil: nextMonth(), remaining: 0, lastError: error.message }
          : { lastError: error.message },
      );
      // Uma esgotada pode ter a renovação noutra data: a API diz qual
      if (error.reason === 'exhausted') void refreshApiKey(apiKey, repository).catch(() => undefined);
    }
  }
  throw new BadRequestException(`Nenhuma chave da SerpApi serviu (${failures.join('; ')})`);
}
