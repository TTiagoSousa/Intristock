// O Yahoo Finance (API não oficial, sem chave): a pesquisa (pelo ISIN dá as bolsas onde a
// ação está), o histórico diário e o de hora a hora de um símbolo. Só leitura; um User-Agent genérico.
const SEARCH_URL = 'https://query2.finance.yahoo.com/v1/finance/search';
const CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; IntriStock)' };
const TIMEOUT_MS = 20_000;
// Um 429, um 5xx ou sem resposta: espera e volta a tentar (1 s, 3 s, 9 s; ou o Retry-After)
const RETRIES = 3;
const RETRY_BASE_MS = 1000;
const MAX_RETRY_WAIT_MS = 30_000;
const HOUR_MS = 3_600_000;

export type YahooQuote = { symbol: string; exchange: string; quoteType: string; name: string };

export type YahooChart = {
  symbol: string;
  // A moeda do preço, normalizada (GBp → GBX)
  currency: string;
  exchange: string;
  name: string | null;
  // Um ponto por dia de bolsa: o dia (UTC, YYYY-MM-DD), o fecho e o ajustado
  days: { date: string; close: number; adjClose: number | null }[];
};

/** Um preço de hora a hora: o instante em que a vela fecha (ms; a que está a decorrer, agora) e o fecho. */
export type YahooHourClose = { time: number; close: number };

/** Um erro do Yahoo, com o estado HTTP (nulo sem resposta), já depois das novas tentativas. */
export class YahooError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

// O Yahoo escreve os pence ingleses como GBp; as corretoras como GBX
export const normalizeCurrency = (code: string) => (code === 'GBp' ? 'GBX' : code.toUpperCase());

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    let status: number | null = null;
    let wait = RETRY_BASE_MS * 3 ** attempt;
    try {
      const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.ok) return (await response.json()) as T;
      status = response.status;
      const retryAfter = Number(response.headers.get('retry-after'));
      if (retryAfter > 0) wait = Math.min(retryAfter * 1000, MAX_RETRY_WAIT_MS);
      // Os 4xx (menos o 429) não mudam por tentar outra vez
      if (status !== 429 && status < 500) throw new YahooError(`O Yahoo respondeu ${status}`, status);
    } catch (error) {
      if (error instanceof YahooError) throw error;
      // Sem resposta (rede, tempo esgotado): conta como para tentar outra vez
    }
    if (attempt >= RETRIES)
      throw new YahooError(status ? `O Yahoo respondeu ${status}` : 'O Yahoo não respondeu', status);
    await sleep(wait);
  }
}

/** As cotações que o Yahoo encontra para um texto (um ISIN, um ticker). */
export async function searchYahoo(query: string): Promise<YahooQuote[]> {
  const data = await getJson<{
    quotes?: { symbol: string; exchange: string; quoteType: string; longname?: string; shortname?: string }[];
  }>(`${SEARCH_URL}?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`);
  return (data.quotes ?? [])
    .filter((quote) => quote.symbol && ['EQUITY', 'ETF'].includes(quote.quoteType))
    .map((quote) => ({
      symbol: quote.symbol,
      exchange: quote.exchange,
      quoteType: quote.quoteType,
      name: quote.longname ?? quote.shortname ?? quote.symbol,
    }));
}

type ChartResponse = {
  chart: {
    result?: {
      meta: { symbol: string; currency: string; exchangeName: string; longName?: string; shortName?: string };
      timestamp?: number[];
      indicators: { quote: { close: (number | null)[] }[]; adjclose?: { adjclose: (number | null)[] }[] };
    }[];
  };
};

/** O histórico diário de um símbolo entre duas datas (sem `from`, os últimos 5 dias). */
export async function fetchYahooChart(symbol: string, from?: Date, to = new Date()): Promise<YahooChart | null> {
  const range = from
    ? `period1=${Math.floor(from.getTime() / 1000)}&period2=${Math.floor(to.getTime() / 1000) + 86_400}`
    : 'range=5d';
  const data = await getJson<ChartResponse>(`${CHART_URL}/${encodeURIComponent(symbol)}?${range}&interval=1d`);
  const result = data.chart.result?.[0];
  if (!result) return null;
  const closes = result.indicators.quote[0]?.close ?? [];
  const adjusted = result.indicators.adjclose?.[0]?.adjclose ?? [];
  const days = (result.timestamp ?? []).flatMap((time, index) => {
    const close = closes[index];
    return close === null || close === undefined
      ? []
      : [{ date: new Date(time * 1000).toISOString().slice(0, 10), close, adjClose: adjusted[index] ?? null }];
  });
  return {
    symbol: result.meta.symbol,
    currency: normalizeCurrency(result.meta.currency),
    exchange: result.meta.exchangeName,
    name: result.meta.longName ?? result.meta.shortName ?? null,
    days,
  };
}

/**
 * Os fechos de hora a hora de um símbolo desde `from` (o Yahoo dá-os para os últimos
 * 730 dias). O Yahoo marca cada vela pelo início; aqui conta no fim dela, para um ponto
 * do gráfico só ver o preço que já havia nessa hora (a vela em curso conta agora).
 */
export async function fetchYahooHourly(symbol: string, from: Date, to = new Date()): Promise<YahooHourClose[]> {
  const data = await getJson<ChartResponse>(
    `${CHART_URL}/${encodeURIComponent(symbol)}?period1=${Math.floor(from.getTime() / 1000)}` +
      `&period2=${Math.floor(to.getTime() / 1000)}&interval=60m`,
  );
  const result = data.chart.result?.[0];
  if (!result) return [];
  const closes = result.indicators.quote[0]?.close ?? [];
  const now = Date.now();
  return (result.timestamp ?? []).flatMap((time, index) => {
    const close = closes[index];
    return close === null || close === undefined ? [] : [{ time: Math.min(time * 1000 + HOUR_MS, now), close }];
  });
}
