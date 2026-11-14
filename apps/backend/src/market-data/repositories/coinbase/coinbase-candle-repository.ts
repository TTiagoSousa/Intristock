import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CandleInterval } from 'src/market-data/dto/find-candles.dto';
import { CandleCache, CandleRow, INTERVAL_MS } from '../candle-cache';

const PRODUCTS = 'https://api.exchange.coinbase.com/products';

const TIMEOUT_MS = 15_000;

// A Coinbase dá até 300 velas por pedido, só nestas granularidades (segundos):
// 60, 300, 900, 3600, 21600 e 86400. Os outros intervalos juntam-se a partir
// da maior que cabe neles
const PAGE = 300;
const BASE_SECONDS: Record<CandleInterval, number> = {
  '1m': 60,
  '3m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 900,
  '1h': 3600,
  '2h': 3600,
  '4h': 3600,
  '1d': 86_400,
  '1w': 86_400,
};

// As semanas começam à segunda, como na Binance (1/1/1970 foi uma quinta)
const WEEK_OFFSET = 4 * 86_400;
// Blocos vazios seguidos que querem dizer que o mercado ainda não existia
const EMPTY_PAGES_END = 3;
// Antes disto a Coinbase não tem velas
const EARLIEST_SECONDS = Date.UTC(2014, 11, 1) / 1000;
// Pedidos de seguida: a API pública aceita perto de 10 por segundo
const RETRIES = 3;
const RETRY_WAIT_MS = 1_000;

// [início s, mínima, máxima, abertura, fecho, volume], da mais recente para a mais antiga
type Coinbase_Candle = [number, number, number, number, number, number];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * As velas do gráfico de um mercado da Coinbase (API pública, sem chave). A
 * Coinbase não tem todos os intervalos nem dá mais de 300 velas de cada vez:
 * pede-se a granularidade que cabe no intervalo, aos blocos e para trás, e
 * juntam-se as velas (abertura da primeira, máxima, mínima, fecho da última e
 * o volume somado). Os minutos sem negócio não têm vela. Fica em cache como a
 * Binance e não grava nada.
 */
@Injectable()
export class CoinbaseCandleRepository {
  private readonly logger = new Logger(CoinbaseCandleRepository.name);
  private readonly cache = new CandleCache();

  findCandles(
    symbol: string,
    interval: CandleInterval,
    to: number | undefined,
    limit: number,
  ): Promise<CandleRow[]> {
    const key = `${symbol}:${interval}:${to ?? 'now'}:${limit}`;
    return this.cache.get(key, interval, () =>
      this.fetchCandles(symbol, interval, to, limit),
    );
  }

  private bucketOf(seconds: number, interval: CandleInterval) {
    const size = INTERVAL_MS[interval] / 1000;
    if (interval === '1w') {
      return Math.floor((seconds - WEEK_OFFSET) / size) * size + WEEK_OFFSET;
    }
    return Math.floor(seconds / size) * size;
  }

  private async fetchCandles(
    symbol: string,
    interval: CandleInterval,
    to: number | undefined,
    limit: number,
  ): Promise<CandleRow[]> {
    const base = BASE_SECONDS[interval];
    const size = INTERVAL_MS[interval] / 1000;
    const now = Math.floor(Date.now() / 1000);
    // Exclusivo: as velas que abrem antes de `to` (sem ele, até à vela em curso)
    const end = to ?? this.bucketOf(now, interval) + size;

    const candles: Coinbase_Candle[] = [];
    const buckets = new Set<number>();
    let windowEnd = Math.floor(end / base) * base;
    let empty = 0;
    const maxPages = Math.ceil((limit * size) / base / PAGE) + 20;

    for (
      let page = 0;
      page < maxPages && windowEnd > EARLIEST_SECONDS;
      page++
    ) {
      const windowStart = windowEnd - PAGE * base;
      // O `end` da Coinbase é inclusivo
      const rows = await this.request(
        symbol,
        base,
        windowStart,
        windowEnd - base,
      );
      windowEnd = windowStart;
      if (!rows.length) {
        if (++empty >= EMPTY_PAGES_END) break;
        continue;
      }
      empty = 0;
      for (const row of rows) {
        if (row[0] >= end) continue;
        candles.push(row);
        buckets.add(this.bucketOf(row[0], interval));
      }
      // Uma a mais: a mais antiga pode ter ficado a meio do bloco
      if (buckets.size > limit) break;
    }

    // Juntar por intervalo, da mais antiga para a mais recente
    candles.sort((a, b) => a[0] - b[0]);
    const bars = new Map<number, CandleRow>();
    for (const [time, low, high, open, close, volume] of candles) {
      const start = this.bucketOf(time, interval);
      const bar = bars.get(start);
      if (!bar) {
        bars.set(start, [start, open, high, low, close, volume]);
      } else {
        bar[2] = Math.max(bar[2], high);
        bar[3] = Math.min(bar[3], low);
        bar[4] = close;
        bar[5] += volume;
      }
    }
    return [...bars.values()].slice(-limit);
  }

  private async request(
    symbol: string,
    granularity: number,
    start: number,
    end: number,
  ): Promise<Coinbase_Candle[]> {
    const url = new URL(`${PRODUCTS}/${encodeURIComponent(symbol)}/candles`);
    url.searchParams.set('granularity', String(granularity));
    url.searchParams.set('start', new Date(start * 1000).toISOString());
    url.searchParams.set('end', new Date(end * 1000).toISOString());

    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await fetch(url, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { 'User-Agent': 'IntriStock' },
        });
      } catch (error) {
        this.logger.warn(`A Coinbase não respondeu: ${String(error)}`);
        throw new ServiceUnavailableException('As velas não estão disponíveis');
      }

      // 429: demasiados pedidos — espera um pouco e tenta outra vez
      if (response.status === 429 && attempt < RETRIES) {
        await sleep(RETRY_WAIT_MS * (attempt + 1));
        continue;
      }
      if (response.status === 429) {
        this.logger.warn('A Coinbase está a limitar os pedidos');
        throw new ServiceUnavailableException(
          'A Coinbase está a limitar os pedidos. Tenta daqui a um minuto',
        );
      }
      if (response.status === 400 || response.status === 404) {
        this.logger.warn(
          `A Coinbase recusou ${symbol}: ${(await response.text()).slice(0, 200)}`,
        );
        throw new BadRequestException('A Coinbase não tem velas deste mercado');
      }
      if (!response.ok) {
        this.logger.warn(`A Coinbase respondeu HTTP ${response.status}`);
        throw new ServiceUnavailableException('As velas não estão disponíveis');
      }
      return (await response.json()) as Coinbase_Candle[];
    }
  }
}
