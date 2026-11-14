import axios from 'axios';
import { PrismaAppSettingRepository } from '../repositories/prisma/prisma-app-setting-repository';
import { ApiKind } from './apiProviders';
import { getApiConfig } from './getApiConfig';

export type ApiHealthStatus =
  | 'online'
  | 'key_rejected'
  | 'offline'
  | 'unconfigured';

export interface ApiHealth {
  kind: ApiKind;
  status: ApiHealthStatus;
  latencyMs: number | null;
  httpStatus: number | null;
  checkedAt: string;
}

// O pedido mais pequeno de cada API que precisa da chave: uma cotação, um país
const PROBES: Record<ApiKind, (url: string, key: string) => Promise<unknown>> =
  {
    currency: (url, key) =>
      axios.get(`${url}/latest`, {
        params: { base: 'USD', symbols: 'EUR', api_key: key },
        timeout: 8_000,
      }),
    country: (url, key) =>
      axios.get(`${url}/countries/PT`, {
        headers: { 'X-CSCAPI-KEY': key },
        timeout: 8_000,
      }),
    // Pública: a lista com uma só firma
    propfirm: (url) =>
      axios.get(`${url}/firms`, { params: { per_page: 1 }, timeout: 8_000 }),
  };

/** Se a API responde com a chave guardada, e em quanto tempo. */
export async function checkApiHealth(
  kind: ApiKind,
  repository: PrismaAppSettingRepository,
): Promise<ApiHealth> {
  const checkedAt = new Date().toISOString();
  const result = (
    status: ApiHealthStatus,
    latencyMs: number | null = null,
    httpStatus: number | null = null,
  ) => ({
    kind,
    status,
    latencyMs,
    httpStatus,
    checkedAt,
  });

  let config: { url: string; key: string };
  try {
    config = await getApiConfig(kind, repository);
  } catch {
    return result('unconfigured');
  }

  const started = Date.now();
  try {
    await PROBES[kind](config.url, config.key);
    return result('online', Date.now() - started, 200);
  } catch (error) {
    const httpStatus = axios.isAxiosError(error)
      ? (error.response?.status ?? null)
      : null;
    const rejected = httpStatus === 401 || httpStatus === 403;
    return result(
      rejected ? 'key_rejected' : 'offline',
      Date.now() - started,
      httpStatus,
    );
  }
}

/** As APIs todas ao mesmo tempo, e o que já está no catálogo. */
export async function getApisHealth(repository: PrismaAppSettingRepository) {
  const [currency, country, propfirm, catalog, ratesUpdatedAt] = await Promise.all([
    checkApiHealth('currency', repository),
    checkApiHealth('country', repository),
    checkApiHealth('propfirm', repository),
    repository.countCatalog(),
    repository.lastRatesUpdate(),
  ]);
  return {
    currency,
    country,
    propfirm,
    catalog: {
      ...catalog,
      ratesUpdatedAt: ratesUpdatedAt?.toISOString() ?? null,
    },
  };
}
