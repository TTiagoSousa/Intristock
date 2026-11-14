import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CandleInterval } from 'src/market-data/dto/find-candles.dto';
import { CandleCache, CandleRow } from '../candle-cache';

export type { CandleRow } from '../candle-cache';

const SPOT_KLINES = 'https://api.binance.com/api/v3/klines';
const FUTURES_KLINES = 'https://fapi.binance.com/fapi/v1/klines';

const TIMEOUT_MS = 15_000;

// [abertura ms, "open", "high", "low", "close", "volume", fecho ms, ...]
type Kline = [number, string, string, string, string, string, number];

/**
 * As velas vêm da API pública da Binance, já no intervalo pedido (sem as
 * juntar a partir das de 1 minuto), e ficam em cache: quem volta ao mesmo
 * bloco, ou abre o mesmo gráfico a seguir, não volta à Binance. Pedidos iguais
 * ao mesmo tempo partilham a mesma ida. Não grava nada: o ClickHouse é das
 * simulações.
 */
@Injectable()
export class BinanceCandleRepository {
  private readonly logger = new Logger(BinanceCandleRepository.name);
  private readonly cache = new CandleCache();

  findCandles(
    type: string,
    symbol: string,
    interval: CandleInterval,
    to: number | undefined,
    limit: number,
  ): Promise<CandleRow[]> {
    const key = `${type}:${symbol}:${interval}:${to ?? 'now'}:${limit}`;
    return this.cache.get(key, interval, () =>
      this.fetchCandles(type, symbol, interval, to, limit),
    );
  }

  private async fetchCandles(
    type: string,
    symbol: string,
    interval: CandleInterval,
    to: number | undefined,
    limit: number,
  ): Promise<CandleRow[]> {
    const url = new URL(type === 'spot' ? SPOT_KLINES : FUTURES_KLINES);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('interval', interval);
    url.searchParams.set('limit', String(limit));
    // O endTime da Binance é inclusivo: a vela que abre em `to` fica de fora
    if (to !== undefined)
      url.searchParams.set('endTime', String(to * 1000 - 1));

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      this.logger.warn(`A Binance não respondeu: ${String(error)}`);
      throw new ServiceUnavailableException('As velas não estão disponíveis');
    }

    // 429: demasiados pedidos; 418: IP bloqueado por ter ignorado os 429
    if (response.status === 429 || response.status === 418) {
      this.logger.warn(
        `A Binance pediu para esperar (HTTP ${response.status}, Retry-After ${response.headers.get('Retry-After')})`,
      );
      throw new ServiceUnavailableException(
        'A Binance está a limitar os pedidos. Tenta daqui a um minuto',
      );
    }
    if (response.status === 400) {
      this.logger.warn(
        `A Binance recusou ${symbol} (${type}): ${(await response.text()).slice(0, 200)}`,
      );
      throw new BadRequestException('A Binance não tem velas deste mercado');
    }
    if (!response.ok) {
      this.logger.warn(`A Binance respondeu HTTP ${response.status}`);
      throw new ServiceUnavailableException('As velas não estão disponíveis');
    }

    const klines = (await response.json()) as Kline[];
    return klines.map(([openTime, open, high, low, close, volume]) => [
      openTime / 1000,
      Number(open),
      Number(high),
      Number(low),
      Number(close),
      Number(volume),
    ]);
  }
}
