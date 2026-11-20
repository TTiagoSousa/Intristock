import { ApiKeyUsage } from '../repositories/api-key-repository';

/** O que a API diz de uma chave: a conta dela e as pesquisas do mês. */
export type KeyAccount = Omit<ApiKeyUsage, 'checkedAt' | 'lastError'> & { plan: string | null };

/** Erro de uma chave que se resolve passando à seguinte: esgotou ou foi recusada. */
export class ApiKeyUnusableError extends Error {
  constructor(
    message: string,
    readonly reason: 'exhausted' | 'rejected',
  ) {
    super(message);
  }
}

export interface ApiKeyProvider {
  label: string;
  docsUrl: string;
  /** A conta da chave (não gasta pesquisas); recusa com `ApiKeyUnusableError` se a chave não serve. */
  account: (key: string) => Promise<KeyAccount>;
}

const SERPAPI_ACCOUNT = 'https://serpapi.com/account.json';

// O primeiro dia do mês seguinte, em UTC (quando não se sabe a renovação do plano)
const nextMonth = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

/** A conta de uma chave da SerpApi: `account.json` dá o plano, o limite, o usado e o que falta. */
async function serpApiAccount(key: string): Promise<KeyAccount> {
  let response: Response;
  try {
    response = await fetch(`${SERPAPI_ACCOUNT}?api_key=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error('A SerpApi não respondeu');
  }
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || typeof body.error === 'string')
    throw new ApiKeyUnusableError(
      response.status === 401 ? 'A SerpApi recusou a chave' : String(body.error ?? `A SerpApi respondeu ${response.status}`),
      'rejected',
    );
  const remaining = typeof body.total_searches_left === 'number' ? body.total_searches_left : null;
  const renewal = typeof body.plan_renewal_date === 'string' ? new Date(`${body.plan_renewal_date}T00:00:00Z`) : null;
  return {
    plan: typeof body.plan_name === 'string' ? body.plan_name : null,
    monthlyLimit: typeof body.searches_per_month === 'number' ? body.searches_per_month : null,
    usedThisMonth: typeof body.this_month_usage === 'number' ? body.this_month_usage : 0,
    remaining,
    // Sem pesquisas: só volta quando o plano renova
    exhaustedUntil: remaining !== null && remaining <= 0 ? (renewal && renewal > new Date() ? renewal : nextMonth()) : null,
  };
}

/** As APIs que aceitam várias chaves e quem as dá. Uma nova entra aqui e no ecrã. */
export const API_KEY_PROVIDERS = {
  motorcycle_prices: {
    label: 'SerpApi',
    docsUrl: 'https://serpapi.com/manage-api-key',
    account: serpApiAccount,
  },
} satisfies Record<string, ApiKeyProvider>;

export type ApiKeyKind = keyof typeof API_KEY_PROVIDERS;
export const API_KEY_KINDS = Object.keys(API_KEY_PROVIDERS) as ApiKeyKind[];
export { nextMonth };
