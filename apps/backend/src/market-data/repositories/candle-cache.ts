import { CandleInterval } from 'src/market-data/dto/find-candles.dto';

// Uma vela: início em segundos UTC, abertura, máxima, mínima, fecho e volume
export type CandleRow = [number, number, number, number, number, number];

// Velas guardadas em memória, somadas em todos os blocos (cada vela, um array de 6
// números, ocupa ~100 bytes: 300 mil são ~30 MB). Os blocos usados há mais tempo
// saem primeiro. Contar blocos não chegava: um bloco vai de 0 a 1000 velas
const CACHE_MAX_ROWS = 300_000;
// Um bloco só com velas fechadas nunca muda; o que tem a vela em curso, pouco
const CLOSED_TTL_MS = 6 * 60 * 60 * 1000;
const OPEN_TTL_MS = 5_000;

export const INTERVAL_MS: Record<CandleInterval, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
  '1w': 604_800_000,
};

interface CacheEntry {
  rows: CandleRow[];
  expiresAt: number;
}

/**
 * Os blocos de velas já pedidos a uma corretora, em memória: quem volta ao
 * mesmo bloco, ou abre o mesmo gráfico a seguir, não volta lá. Pedidos iguais
 * ao mesmo tempo partilham a mesma ida. Cada corretora tem a sua.
 */
export class CandleCache {
  private readonly cache = new Map<string, CacheEntry>();
  // Quantas velas há no total na cache
  private rows = 0;
  private readonly inFlight = new Map<string, Promise<CandleRow[]>>();

  get(
    key: string,
    interval: CandleInterval,
    load: () => Promise<CandleRow[]>,
  ): Promise<CandleRow[]> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      // Volta ao fim da fila: foi usado agora
      this.cache.delete(key);
      this.cache.set(key, cached);
      return Promise.resolve(cached.rows);
    }

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const request = load()
      .then((rows) => {
        this.remember(key, rows, interval);
        return rows;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, request);
    return request;
  }

  private remember(key: string, rows: CandleRow[], interval: CandleInterval) {
    const last = rows.at(-1);
    const closed =
      last !== undefined &&
      last[0] * 1000 + INTERVAL_MS[interval] <= Date.now();
    // Um bloco vazio (antes do início do mercado) também não muda
    const ttl = closed || rows.length === 0 ? CLOSED_TTL_MS : OPEN_TTL_MS;

    const now = Date.now();
    this.drop(key);
    this.cache.set(key, { rows, expiresAt: now + ttl });
    this.rows += rows.length;
    if (this.rows <= CACHE_MAX_ROWS) return;
    // Primeiro os que já expiraram, depois os usados há mais tempo
    for (const [oldKey, entry] of this.cache) {
      if (oldKey !== key && entry.expiresAt <= now) this.drop(oldKey);
    }
    for (const oldest of this.cache.keys()) {
      if (this.rows <= CACHE_MAX_ROWS || oldest === key) break;
      this.drop(oldest);
    }
  }

  private drop(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return;
    this.rows -= entry.rows.length;
    this.cache.delete(key);
  }
}
