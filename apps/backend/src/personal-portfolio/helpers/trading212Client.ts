// A API pública da Trading 212 (v0): só pedidos de leitura. Autenticação Basic com a
// chave e o segredo; os limites são por conta e vêm nos cabeçalhos x-ratelimit-*.
const BASE_URL = 'https://live.trading212.com';
const API_PREFIX = '/api/v0';
// Entre páginas do histórico (20 pedidos por minuto)
const PAGE_GAP_MS = 3100;
// Quantas vezes se espera por um 429 antes de desistir
const MAX_RATE_LIMIT_WAITS = 5;

export type Trading212Credentials = { apiKey: string; apiSecret: string };

export type Trading212Account = { id: number; currency: string };

/** Um movimento de dinheiro (history/transactions). */
export type Trading212CashMovement = {
  type: string;
  amount: number;
  currency: string;
  reference: string;
  dateTime: string;
};

/** Um instrumento como vem nas ordens e nos dividendos. */
export type Trading212Instrument = { ticker: string; name: string; isin: string; currency: string };

/** Uma ordem do histórico (só interessam as que têm execução, `fill`). */
export type Trading212Order = {
  order: {
    id: number;
    ticker: string;
    side: 'BUY' | 'SELL';
    status: string;
    createdAt: string;
    instrument: Trading212Instrument;
  };
  fill?: {
    id: number;
    filledAt: string;
    price: number;
    quantity: number;
    type: string;
    // Pode faltar (um acerto sem dinheiro): sem ela, a ordem entra como acerto de quantidade
    walletImpact?: {
      currency: string;
      netValue: number;
      fxRate: number | null;
      realisedProfitLoss: number | null;
    } | null;
  } | null;
};

/** Um dividendo (o valor já na moeda da conta). */
export type Trading212Dividend = {
  reference: string;
  ticker: string;
  instrument: Trading212Instrument;
  quantity: number;
  amount: number;
  currency: string;
  grossAmountPerShare: number;
  paidOn: string;
  type: string;
};

export class Trading212Error extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function get<T>(credentials: Trading212Credentials, path: string): Promise<T> {
  const authorization =
    'Basic ' + Buffer.from(`${credentials.apiKey}:${credentials.apiSecret}`).toString('base64');
  for (let waits = 0; ; waits += 1) {
    const response = await fetch(BASE_URL + path, {
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 429 && waits < MAX_RATE_LIMIT_WAITS) {
      const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
      await sleep(Math.max(2000, (reset || 0) - Date.now() + 500));
      continue;
    }
    if (response.status === 401) throw new Trading212Error('A Trading 212 recusou a chave', 401);
    if (response.status === 403)
      throw new Trading212Error('A chave não tem permissão para isto (vê as permissões na Trading 212)', 403);
    if (!response.ok) throw new Trading212Error(`A Trading 212 respondeu ${response.status}`, response.status);
    return (await response.json()) as T;
  }
}

const nextPath = (nextPagePath: string | null) =>
  nextPagePath ? (nextPagePath.startsWith(API_PREFIX) ? nextPagePath : API_PREFIX + nextPagePath) : null;

/**
 * Um histórico às páginas, do mais recente para trás. Para quando `stop` diz que
 * uma página já chega (o resto já foi importado) ou quando acabam as páginas.
 */
async function fetchHistory<T>(
  credentials: Trading212Credentials,
  firstPath: string,
  stop: (page: T[]) => boolean | Promise<boolean>,
): Promise<T[]> {
  const items: T[] = [];
  let path: string | null = firstPath;
  while (path) {
    const page: { items: T[]; nextPagePath: string | null } = await get(credentials, path);
    items.push(...page.items);
    path = (await stop(page.items)) ? null : nextPath(page.nextPagePath);
    if (path) await sleep(PAGE_GAP_MS);
  }
  return items;
}

/** A conta da chave: o número e a moeda principal. Serve também para validar a chave. */
export async function fetchTrading212Account(credentials: Trading212Credentials) {
  const summary = await get<Trading212Account>(credentials, `${API_PREFIX}/equity/account/summary`);
  return { id: String(summary.id), currency: summary.currency };
}

/**
 * Os movimentos de dinheiro, do mais recente para trás, até ao `since` (inclusive).
 * Sem `since`, o histórico todo. O `time` da API não filtra (vai com o `cursor`).
 */
export async function fetchTrading212CashMovements(
  credentials: Trading212Credentials,
  since: Date | null,
): Promise<Trading212CashMovement[]> {
  const movements = await fetchHistory<Trading212CashMovement>(
    credentials,
    `${API_PREFIX}/equity/history/transactions?limit=50`,
    (page) => Boolean(since && page.some((item) => new Date(item.dateTime).getTime() < since.getTime())),
  );
  return since
    ? movements.filter((item) => new Date(item.dateTime).getTime() >= since.getTime())
    : movements;
}

/** As ordens, do mais recente para trás, até a uma página em que já se conheçam todas. */
export function fetchTrading212Orders(
  credentials: Trading212Credentials,
  allKnown: (page: Trading212Order[]) => Promise<boolean>,
) {
  return fetchHistory<Trading212Order>(credentials, `${API_PREFIX}/equity/history/orders?limit=50`, allKnown);
}

/** Os dividendos, do mais recente para trás, até a uma página em que já se conheçam todos. */
export function fetchTrading212Dividends(
  credentials: Trading212Credentials,
  allKnown: (page: Trading212Dividend[]) => Promise<boolean>,
) {
  return fetchHistory<Trading212Dividend>(
    credentials,
    `${API_PREFIX}/equity/history/dividends?limit=50`,
    allKnown,
  );
}
