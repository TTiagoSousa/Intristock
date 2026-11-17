import { PrismaAppSettingRepository } from '../repositories/prisma/prisma-app-setting-repository';
import { ApiKind, PROVIDERS_BY_KIND } from './apiProviders';
import { readApiSettings } from './readApiSettings';

// A chave nunca volta ao browser: só se mostra que existe e os últimos 4 caracteres
const preview = (key: string | null) => (key ? `••••${key.slice(-4)}` : null);

async function viewOf(kind: ApiKind, repository: PrismaAppSettingRepository) {
  const stored = await readApiSettings(kind, repository);
  const fallback = PROVIDERS_BY_KIND[kind][0];
  return {
    provider: stored.provider ?? fallback.id,
    url: stored.url ?? fallback.defaultUrl,
    keySet: Boolean(stored.key),
    keyPreview: preview(stored.key),
  };
}

export async function getApiSettings(repository: PrismaAppSettingRepository) {
  return {
    currency: await viewOf('currency', repository),
    country: await viewOf('country', repository),
    propfirm: await viewOf('propfirm', repository),
    exchange: await viewOf('exchange', repository),
    providers: PROVIDERS_BY_KIND,
  };
}
