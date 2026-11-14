import type { Bar, BarsRequest, BarsResult, Timeframe as Chart_Timeframe } from 'openchartscandle/candlestick';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';

// [início em segundos UTC, abertura, máxima, mínima, fecho, volume]
export type Candle_Row = [number, number, number, number, number, number];

interface Candle_Block {
  bars: Candle_Row[];
  noMore: boolean;
}

// O backend não dá mais do que isto por pedido
const MAX_BLOCK = 1000;

// Cada tempo gráfico da biblioteca no intervalo do backend, pela duração
const INTERVAL_BY_SECONDS: Record<number, string> = {
  60: '1m',
  180: '3m',
  300: '5m',
  900: '15m',
  1800: '30m',
  3600: '1h',
  7200: '2h',
  14400: '4h',
  86400: '1d',
  604800: '1w',
};

// Os tempos gráficos do seletor (ids da biblioteca), todos com velas nas duas
// corretoras (na Coinbase, os que ela não tem juntam-se no backend)
export const CHART_TIMEFRAMES = ['1', '3', '5', '15', '30', '60', '120', '240', '1D', '1W'];

/**
 * Um bloco de velas de um mercado para o gráfico: as mais recentes antes de
 * `request.to`. Vem do backend (/market/candles), que as vai buscar à corretora
 * do mercado (Binance ou Coinbase).
 * O pedido cai sozinho quando o gráfico já não precisa dele (outro mercado ou
 * outro tempo gráfico).
 */
export const fetchCandleBlock = async (
  instrumentId: string,
  timeframe: Chart_Timeframe,
  request: BarsRequest,
): Promise<BarsResult> => {
  const interval = INTERVAL_BY_SECONDS[timeframe.seconds];
  if (!interval) return { bars: [], noMore: true };

  const { data } = await http.get<Candle_Block>(End_Points.Market_Candles_Endpoint(), {
    params: {
      instrumentId,
      interval,
      to: Math.floor(request.to),
      limit: Math.min(MAX_BLOCK, request.countBack),
    },
    signal: request.signal,
  });

  const bars: Bar[] = data.bars.map(([time, open, high, low, close, volume]) => ({
    time,
    open,
    high,
    low,
    close,
    volume,
  }));
  return { bars, noMore: data.noMore };
};
