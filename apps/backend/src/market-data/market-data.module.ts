import { Module } from '@nestjs/common';
import { MarketDataController } from './market-data.controller';
import { MarketDataService } from './market-data.service';
import { PrismaMarketDataRepository } from './repositories/prisma/prisma-market-data-repository';
import { BinanceCandleRepository } from './repositories/binance/binance-candle-repository';
import { CoinbaseCandleRepository } from './repositories/coinbase/coinbase-candle-repository';

// Catálogo de mercados (Asset/Instrument), pedidos de velas para as simulações
// (vivem no ClickHouse e quem as escreve é o downloader, apps/downloader) e as
// velas dos gráficos, que vêm da corretora (Binance ou Coinbase) aos blocos, sem
// passar pelo ClickHouse
@Module({
  controllers: [MarketDataController],
  providers: [
    MarketDataService,
    {
      provide: PrismaMarketDataRepository,
      useClass: PrismaMarketDataRepository,
    },
    BinanceCandleRepository,
    CoinbaseCandleRepository,
  ],
})
export class MarketDataModule {}
