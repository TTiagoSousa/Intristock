import { BinanceCandleRepository } from '../repositories/binance/binance-candle-repository';
import { CoinbaseCandleRepository } from '../repositories/coinbase/coinbase-candle-repository';
import { CandleRow } from '../repositories/candle-cache';

const HOUR_MS = 3_600_000;
// Quantas velas por pedido (o máximo da rota das velas)
const BLOCK = 1000;
// Para não andar para trás sem fim num mercado com o histórico todo
const MAX_BLOCKS = 20;

export type ExchangeMarket = { source: string; type: string; symbol: string };

/**
 * As velas de um mercado da Binance ou da Coinbase desde `from`, aos blocos e para trás
 * (as mesmas idas e a mesma cache dos gráficos), da mais antiga.
 */
async function candlesSince(
  market: ExchangeMarket,
  interval: '1d' | '1h',
  from: Date,
  binance: BinanceCandleRepository,
  coinbase: CoinbaseCandleRepository,
): Promise<CandleRow[]> {
  const find = (to: number | undefined) =>
    market.source === 'binance'
      ? binance.findCandles(market.type, market.symbol, interval, to, BLOCK)
      : coinbase.findCandles(market.symbol, interval, to, BLOCK);
  const rows: CandleRow[] = [];
  let to: number | undefined;
  for (let block = 0; block < MAX_BLOCKS; block += 1) {
    const page = await find(to);
    if (!page.length) break;
    rows.push(...page);
    const earliest = Math.min(...page.map((row) => row[0]));
    if (earliest * 1000 <= from.getTime() || page.length < BLOCK) break;
    to = earliest;
  }
  const byTime = new Map(rows.filter((row) => row[0] * 1000 >= from.getTime() - 86_400_000).map((row) => [row[0], row]));
  return [...byTime.values()].sort((a, b) => a[0] - b[0]);
}

/** Os fechos diários (dias UTC; o de hoje é o preço de agora) desde `from`. */
export async function fetchExchangeDays(
  market: ExchangeMarket,
  from: Date,
  binance: BinanceCandleRepository,
  coinbase: CoinbaseCandleRepository,
) {
  const rows = await candlesSince(market, '1d', from, binance, coinbase);
  return rows.map((row) => ({ date: new Date(row[0] * 1000).toISOString().slice(0, 10), close: row[4], adjClose: null }));
}

/** Os fechos de hora a hora desde `from`, cada um no instante em que a vela fecha (a em curso, agora). */
export async function fetchExchangeHours(
  market: ExchangeMarket,
  from: Date,
  binance: BinanceCandleRepository,
  coinbase: CoinbaseCandleRepository,
) {
  const rows = await candlesSince(market, '1h', from, binance, coinbase);
  const now = Date.now();
  return rows.map((row) => ({ time: Math.min(row[0] * 1000 + HOUR_MS, now), close: row[4] }));
}
