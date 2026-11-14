import { CandleInterval } from 'src/market-data/dto/find-candles.dto';

// Uma vela: início em segundos UTC, abertura, máxima, mínima, fecho e volume
export type CandleRow = [number, number, number, number, number, number];

// Blocos guardados em memória (cada um até 1000 velas, ~50 KB): os mais
// antigos saem primeiro
const CACHE_LIMIT = 2000;
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

    this.cache.set(key, { rows, expiresAt: Date.now() + ttl });
    for (const oldest of this.cache.keys()) {
      if (this.cache.size <= CACHE_LIMIT) break;
      this.cache.delete(oldest);
    }
  }
}
