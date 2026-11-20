import { Module } from '@nestjs/common';
import { CurrencyModule } from 'src/currency/currency.module';
import { MarketDataModule } from 'src/market-data/market-data.module';
import { ApiKeyModule } from 'src/api-key/api-key.module';
import { PersonalPortfolioController } from './personal-portfolio.controller';
import { PersonalPortfolioService } from './personal-portfolio.service';
import { BrokerSyncService } from './broker-sync.service';
import { GoodsController } from './goods.controller';
import { GoodsService } from './goods.service';
import { GoodsValuationService } from './goods-valuation.service';
import { PrismaPersonalPortfolioRepository } from './repositories/prisma/prisma-personal-portfolio-repository';

@Module({
  // O resumo converte pela cotação do dia; as ações (ativos, mercados, preços) vêm do market-data;
  // os preços das motas, das chaves da SerpApi (api-key)
  imports: [CurrencyModule, MarketDataModule, ApiKeyModule],
  // Os bens primeiro: `goods/...` não pode cair no `:portfolioId/...` dos portefólios
  controllers: [GoodsController, PersonalPortfolioController],
  providers: [
    PersonalPortfolioService,
    BrokerSyncService,
    GoodsService,
    GoodsValuationService,
    {
      provide: PrismaPersonalPortfolioRepository,
      useClass: PrismaPersonalPortfolioRepository,
    },
  ],
})
export class PersonalPortfolioModule {}
