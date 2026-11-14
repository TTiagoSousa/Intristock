import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaMarketDataRepository } from './repositories/prisma/prisma-market-data-repository';
import { FindInstrumentsDto } from './dto/find-instruments.dto';
import { CreateMarketDataDownloadDto } from './dto/create-market-data-download.dto';
import { syncInstruments } from './helpers/syncInstruments';
import {
  BINANCE_QUOTES,
  fetchBinanceInstruments,
} from './helpers/fetchBinanceInstruments';
import {
  COINBASE_QUOTES,
  fetchCoinbaseInstruments,
} from './helpers/fetchCoinbaseInstruments';
import { findInstruments } from './helpers/findInstruments';
import { findInstrumentFacets } from './helpers/findInstrumentFacets';
import { createMarketDataDownload } from './helpers/createMarketDataDownload';
import { findMarketDataDownload } from './helpers/findMarketDataDownload';
import { findCandles } from './helpers/findCandles';
import { FindCandlesDto } from './dto/find-candles.dto';
import { BinanceCandleRepository } from './repositories/binance/binance-candle-repository';
import { CoinbaseCandleRepository } from './repositories/coinbase/coinbase-candle-repository';

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class MarketDataService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(MarketDataService.name);
  private syncTimer?: NodeJS.Timeout;

  constructor(
    private readonly repository: PrismaMarketDataRepository,
    private readonly binance: BinanceCandleRepository,
    private readonly coinbase: CoinbaseCandleRepository,
  ) {}

  // A lista de mercados entra no arranque (cada deploy reinicia o backend) e
  // atualiza-se uma vez por dia. Sem await: as corretoras demoram alguns
  // segundos e a app não fica à espera delas para arrancar
  onApplicationBootstrap() {
    void this.syncInstruments();
    this.syncTimer = setInterval(
      () => void this.syncInstruments(),
      SYNC_INTERVAL_MS,
    );
  }

  onModuleDestroy() {
    clearInterval(this.syncTimer);
  }

  // Cada corretora à parte: uma em baixo não impede a outra
  async syncInstruments() {
    await this.syncSource('binance', 'Binance', async () =>
      syncInstruments(
        this.repository,
        'binance',
        await fetchBinanceInstruments(),
        BINANCE_QUOTES,
      ),
    );
    await this.syncSource('coinbase', 'Coinbase', async () =>
      syncInstruments(
        this.repository,
        'coinbase',
        await fetchCoinbaseInstruments(),
        COINBASE_QUOTES,
      ),
    );
  }

  private async syncSource(
    source: string,
    name: string,
    sync: () => Promise<Record<string, number>>,
  ) {
    try {
      const result = await sync();
      this.logger.log(`Mercados da ${name}: ${JSON.stringify(result)}`);
    } catch (error) {
      // Sem internet ou com a corretora em baixo, fica a lista que já havia
      this.logger.warn(
        `Não foi possível sincronizar a ${name} (${source}): ${(error as Error).message}`,
      );
    }
  }

  findInstruments(query: FindInstrumentsDto) {
    return findInstruments(query, this.repository);
  }

  findInstrumentFacets() {
    return findInstrumentFacets(this.repository);
  }

  createDownload(userId: string, dto: CreateMarketDataDownloadDto) {
    return createMarketDataDownload(userId, dto, this.repository);
  }

  findDownload(userId: string, id: string) {
    return findMarketDataDownload(userId, id, this.repository);
  }

  findCandles(dto: FindCandlesDto) {
    return findCandles(dto, this.repository, this.binance, this.coinbase);
  }
}
