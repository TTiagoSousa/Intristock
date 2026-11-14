import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FindCandlesDto, MAX_CANDLES } from '../dto/find-candles.dto';
import { BinanceCandleRepository } from '../repositories/binance/binance-candle-repository';
import { CoinbaseCandleRepository } from '../repositories/coinbase/coinbase-candle-repository';
import { CandleRow } from '../repositories/candle-cache';
import { PrismaMarketDataRepository } from '../repositories/prisma/prisma-market-data-repository';

/**
 * Um bloco de velas para o gráfico: as `limit` mais recentes antes de `to`.
 * O gráfico pede o seguinte (mais antigo) ao arrastar para a esquerda; menos
 * velas do que as pedidas quer dizer que o mercado não tem mais para trás.
 */
export async function findCandles(
  dto: FindCandlesDto,
  repository: PrismaMarketDataRepository,
  binance: BinanceCandleRepository,
  coinbase: CoinbaseCandleRepository,
) {
  const instrument = await repository.findInstrumentById(dto.instrumentId);
  if (!instrument) throw new NotFoundException('Ativo não encontrado');
  const limit = dto.limit ?? MAX_CANDLES;
  // Cada corretora com a sua API de velas
  let bars: CandleRow[];
  if (instrument.source === 'binance') {
    bars = await binance.findCandles(
      instrument.type,
      instrument.symbol,
      dto.interval,
      dto.to,
      limit,
    );
  } else if (instrument.source === 'coinbase') {
    bars = await coinbase.findCandles(
      instrument.symbol,
      dto.interval,
      dto.to,
      limit,
    );
  } else {
    throw new BadRequestException('Este mercado não tem gráfico');
  }
  return { bars, noMore: bars.length < limit };
}
