import { isPublicHost } from './isPublicHost';

// A API do solidtime (v1), só pedidos de leitura: o endereço da instalação + `/api/v1` e
// a chave como Bearer. Limite por omissão de 200 pedidos por minuto por utilizador.
const API_PREFIX = '/api/v1';
// As listas vêm até 500 de cada vez
const PAGE_SIZE = 500;
// Quantas vezes se espera por um 429 antes de desistir
const MAX_RATE_LIMIT_WAITS = 5;
const TIMEOUT_MS = 20_000;

export type SolidtimeCredentials = { baseUrl: string; token: string };

export type SolidtimeUser = { id: string; name: string; email: string; timezone: string | null };

export type SolidtimeMembership = {
  id: string;
  role: string;
  organization: { id: string; name: string; currency: string };
};

export type SolidtimeOrganization = {
  id: string;
  name: string;
  currency: string;
  // Em cêntimos
  billable_rate: number | null;
};

export type SolidtimeClient = { id: string; name: string; is_archived: boolean };

export type SolidtimeProject = {
  id: string;
  name: string;
  color: string | null;
  client_id: string | null;
  is_archived: boolean;
  billable_rate: number | null;
  is_billable: boolean;
};

export type SolidtimeMember = {
  id: string;
  user_id: string;
  name: string;
  billable_rate: number | null;
};

export type SolidtimeTimeEntry = {
  id: string;
  start: string;
  end: string | null;
  duration: number | null;
  description: string | null;
  project_id: string | null;
  user_id: string;
  billable: boolean;
};

export class SolidtimeError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Uma só mensagem para «não respondeu», «não é um solidtime», «não se pode ir lá» e os
// redirecionamentos: mensagens diferentes serviam para mapear a rede a partir do servidor
export const SOLIDTIME_UNREACHABLE = 'Não foi possível falar com um solidtime nesse endereço';

async function request<T>(credentials: SolidtimeCredentials, path: string): Promise<T> {
  let url: URL;
  try {
    url = new URL(`${credentials.baseUrl}${API_PREFIX}${path}`);
  } catch {
    throw new SolidtimeError(SOLIDTIME_UNREACHABLE, null);
  }
  if (!(await isPublicHost(url.hostname))) throw new SolidtimeError(SOLIDTIME_UNREACHABLE, null);
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${credentials.token}`, Accept: 'application/json' },
        // Um redirecionamento podia levar a chave (e o pedido) para outro sítio: é um erro
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new SolidtimeError(SOLIDTIME_UNREACHABLE, null);
    }
    if (response.status === 429 && attempt < MAX_RATE_LIMIT_WAITS) {
      const retry = Number(response.headers.get('retry-after'));
      await wait((Number.isFinite(retry) && retry > 0 ? Math.min(retry, 120) : 15) * 1000);
      continue;
    }
    if (response.status === 401) throw new SolidtimeError('O solidtime recusou a chave', 401);
    if (response.status === 403) throw new SolidtimeError('A chave não tem acesso a isto no solidtime', 403);
    if (!response.ok) throw new SolidtimeError(SOLIDTIME_UNREACHABLE, response.status);
    try {
      return (await response.json()) as T;
    } catch {
      throw new SolidtimeError(SOLIDTIME_UNREACHABLE, response.status);
    }
  }
}

// Um limite para uma API que ignore a página e devolva sempre a mesma
const MAX_PAGES = 1000;

/**
 * As listas às páginas (`page`), até à última: pelo `meta.last_page` quando vem; sem ele, até uma
 * página vazia ou mais curta que a primeira. Uma página sem nada de novo também acaba a lista.
 */
async function listAll<T extends { id: string }>(credentials: SolidtimeCredentials, path: string): Promise<T[]> {
  const rows = new Map<string, T>();
  let firstSize = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await request<{ data: T[]; meta?: { last_page?: number | null } }>(
      credentials,
      `${path}${path.includes('?') ? '&' : '?'}page=${page}`,
    );
    const before = rows.size;
    for (const row of result.data) rows.set(row.id, row);
    if (page === 1) firstSize = result.data.length;
    const lastPage = result.meta?.last_page;
    if (typeof lastPage === 'number') {
      if (page >= lastPage) break;
    } else if (result.data.length === 0 || result.data.length < firstSize) break;
    if (rows.size === before) break;
  }
  return [...rows.values()];
}

export const fetchSolidtimeUser = async (credentials: SolidtimeCredentials) =>
  (await request<{ data: SolidtimeUser }>(credentials, '/users/me')).data;

export const fetchSolidtimeMemberships = async (credentials: SolidtimeCredentials) =>
  (await request<{ data: SolidtimeMembership[] }>(credentials, '/users/me/memberships')).data;

const org = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;

export const fetchSolidtimeOrganization = async (credentials: SolidtimeCredentials, organizationId: string) =>
  (await request<{ data: SolidtimeOrganization }>(credentials, org(organizationId))).data;

export const fetchSolidtimeClients = (credentials: SolidtimeCredentials, organizationId: string) =>
  listAll<SolidtimeClient>(credentials, `${org(organizationId)}/clients`);

export const fetchSolidtimeProjects = (credentials: SolidtimeCredentials, organizationId: string) =>
  listAll<SolidtimeProject>(credentials, `${org(organizationId)}/projects`);

export const fetchSolidtimeMembers = (credentials: SolidtimeCredentials, organizationId: string) =>
  listAll<SolidtimeMember>(credentials, `${org(organizationId)}/members`);

/**
 * Os registos de tempo desde `start` (ou todos), do mais recente para trás: `limit` até 500 e
 * `offset`, até uma página vir com menos de `PAGE_SIZE` (o `meta.total` nem sempre vem).
 * `complete` diz se a lista veio toda: só então se pode apagar o que lá não está.
 */
export async function fetchSolidtimeTimeEntries(
  credentials: SolidtimeCredentials,
  organizationId: string,
  start: Date | null,
): Promise<{ entries: SolidtimeTimeEntry[]; complete: boolean }> {
  const rows = new Map<string, SolidtimeTimeEntry>();
  const since = start ? `&start=${encodeURIComponent(start.toISOString().replace(/\.\d{3}Z$/, 'Z'))}` : '';
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await request<{ data: SolidtimeTimeEntry[]; meta?: { total?: number | null } }>(
      credentials,
      `${org(organizationId)}/time-entries?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}${since}`,
    );
    const before = rows.size;
    for (const row of result.data) rows.set(row.id, row);
    if (result.data.length < PAGE_SIZE) {
      // Com o total a dizer que faltam (registos novos a meio da leitura), a lista não está completa
      const total = result.meta?.total;
      return { entries: [...rows.values()], complete: typeof total !== 'number' || rows.size >= total };
    }
    // Uma página cheia sem nada de novo: a API ignora o `offset` e a lista não é de confiança
    if (rows.size === before) return { entries: [...rows.values()], complete: false };
  }
  return { entries: [...rows.values()], complete: false };
}
