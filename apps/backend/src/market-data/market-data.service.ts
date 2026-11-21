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
import { linkInstrumentsToPlatform } from './helpers/linkInstrumentsToPlatform';
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
import { AppSettingService } from 'src/app-setting/app-setting.service';
import { startScheduledJob } from 'src/common/scheduledJob';

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
// A primeira volta depois do arranque (as outras tarefas têm outros tempos)
const SYNC_STAGGER_MS = 15_000;

@Injectable()
export class MarketDataService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(MarketDataService.name);
  private stopSync?: () => void;

  constructor(
    private readonly repository: PrismaMarketDataRepository,
    private readonly binance: BinanceCandleRepository,
    private readonly coinbase: CoinbaseCandleRepository,
    private readonly settings: AppSettingService,
  ) {}

  // A lista de mercados atualiza-se uma vez por dia. No arranque só se já passou o
  // dia desde a última vez (cada deploy reinicia o backend; numa instalação nova,
  // logo): a hora fica no AppSetting. Sem await: a app não fica à espera
  onApplicationBootstrap() {
    this.stopSync = startScheduledJob({
      name: 'market-data.instruments',
      everyMs: SYNC_INTERVAL_MS,
      staggerMs: SYNC_STAGGER_MS,
      store: this.settings,
      run: () => this.syncInstruments(),
      logger: this.logger,
    });
  }

  onModuleDestroy() {
    this.stopSync?.();
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
      const result = {
        ...(await sync()),
        ...(await linkInstrumentsToPlatform(this.repository, source)),
      };
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
