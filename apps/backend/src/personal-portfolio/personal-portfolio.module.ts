import { Module } from '@nestjs/common';
import { CurrencyModule } from 'src/currency/currency.module';
import { PersonalPortfolioController } from './personal-portfolio.controller';
import { PersonalPortfolioService } from './personal-portfolio.service';
import { PrismaPersonalPortfolioRepository } from './repositories/prisma/prisma-personal-portfolio-repository';

@Module({
  // O resumo converte pela cotação do dia
  imports: [CurrencyModule],
  controllers: [PersonalPortfolioController],
  providers: [
    PersonalPortfolioService,
    {
      provide: PrismaPersonalPortfolioRepository,
      useClass: PrismaPersonalPortfolioRepository,
    },
  ],
})
export class PersonalPortfolioModule {}
