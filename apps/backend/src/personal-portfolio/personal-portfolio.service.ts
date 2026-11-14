import { Injectable } from '@nestjs/common';
import { CurrencyService } from 'src/currency/currency.service';
import { PrismaPersonalPortfolioRepository } from './repositories/prisma/prisma-personal-portfolio-repository';
import { CreateCashTransactionDto } from './dto/personal-portfolio.dto';
import { findPortfolios } from './helpers/findPortfolios';
import { createPortfolio } from './helpers/createPortfolio';
import { findPortfolioTransactions } from './helpers/findPortfolioTransactions';
import { createCashTransaction } from './helpers/createCashTransaction';
import { summarizePortfolios } from './helpers/summarizePortfolios';

/**
 * Os portefólios de cada pessoa (finanças pessoais) e as transações deles. Cada
 * transação tem um ativo; para já só há o dinheiro passivo. Cada um só vê os seus.
 */
@Injectable()
export class PersonalPortfolioService {
  constructor(
    private readonly repository: PrismaPersonalPortfolioRepository,
    private readonly currencyService: CurrencyService,
  ) {}

  summarize(userId: string, currencyId?: string) {
    return summarizePortfolios(
      userId,
      currencyId,
      this.repository,
      this.currencyService,
    );
  }

  findPortfolios(userId: string) {
    return findPortfolios(userId, this.repository);
  }

  createPortfolio(userId: string, name: string) {
    return createPortfolio(userId, name, this.repository);
  }

  findTransactions(userId: string, portfolioId: string) {
    return findPortfolioTransactions(userId, portfolioId, this.repository);
  }

  createCashTransaction(
    userId: string,
    portfolioId: string,
    dto: CreateCashTransactionDto,
  ) {
    return createCashTransaction(userId, portfolioId, dto, this.repository);
  }
}
