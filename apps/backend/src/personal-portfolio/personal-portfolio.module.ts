import { Module } from '@nestjs/common';
import { CurrencyModule } from 'src/currency/currency.module';
import { MarketDataModule } from 'src/market-data/market-data.module';
import { PersonalPortfolioController } from './personal-portfolio.controller';
import { PersonalPortfolioService } from './personal-portfolio.service';
import { BrokerSyncService } from './broker-sync.service';
import { PrismaPersonalPortfolioRepository } from './repositories/prisma/prisma-personal-portfolio-repository';

@Module({
  // O resumo converte pela cotação do dia; as ações (ativos, mercados, preços) vêm do market-data
  imports: [CurrencyModule, MarketDataModule],
  controllers: [PersonalPortfolioController],
  providers: [
    PersonalPortfolioService,
    BrokerSyncService,
    {
      provide: PrismaPersonalPortfolioRepository,
      useClass: PrismaPersonalPortfolioRepository,
    },
  ],
})
export class PersonalPortfolioModule {}
