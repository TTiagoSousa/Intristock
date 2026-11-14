import { latestRateHour } from 'src/currency/helpers/latestRateHour';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PersonalPortfolio } from 'src/generated/prisma/client/client';
import {
  PersonalPortfolioRepository,
  PortfolioCurrency,
  PortfolioTransactionData,
  PortfolioTransactionWithRefs,
  PortfolioWithCount,
} from '../personal-portfolio-repository';

const CURRENCY = {
  select: { id: true, name: true, shortCode: true, symbol: true, rate: true },
};

const TRANSACTION_INCLUDE = {
  asset: {
    select: { id: true, name: true, assetClass: true, subClass: true },
  },
  currency: CURRENCY,
  bankAccount: { select: { id: true, name: true } },
};

@Injectable()
export class PrismaPersonalPortfolioRepository implements PersonalPortfolioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPortfolios(userId: string): Promise<PortfolioWithCount[]> {
    return this.prisma.personalPortfolio.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: {
        platform: { select: { id: true, name: true, logo: true } },
        _count: { select: { transactions: true } },
      },
    });
  }

  async findPortfolio(
    userId: string,
    portfolioId: string,
  ): Promise<PersonalPortfolio | null> {
    return this.prisma.personalPortfolio.findFirst({
      where: { id: portfolioId, userId },
    });
  }

  async findPortfolioByName(
    userId: string,
    name: string,
  ): Promise<PersonalPortfolio | null> {
    return this.prisma.personalPortfolio.findFirst({
      where: { userId, name: { equals: name, mode: 'insensitive' } },
    });
  }

  async createPortfolio(
    userId: string,
    name: string,
  ): Promise<PersonalPortfolio> {
    return this.prisma.personalPortfolio.create({ data: { userId, name } });
  }

  async findTransactions(
    portfolioId: string,
  ): Promise<PortfolioTransactionWithRefs[]> {
    return this.prisma.personalPortfolioTransaction.findMany({
      where: { portfolioId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: TRANSACTION_INCLUDE,
    });
  }

  async createTransaction(
    data: PortfolioTransactionData,
  ): Promise<PortfolioTransactionWithRefs> {
    return this.prisma.personalPortfolioTransaction.create({
      data: {
        ...data,
        // A hora das cotações com que se converte (a mais recente guardada)
        rateHour: await latestRateHour(this.prisma),
      },
      include: TRANSACTION_INCLUDE,
    });
  }

  // Todas as transações da pessoa, da mais antiga à mais recente (o resumo soma-as por ordem)
  async findUserTransactions(
    userId: string,
  ): Promise<PortfolioTransactionWithRefs[]> {
    return this.prisma.personalPortfolioTransaction.findMany({
      where: { portfolio: { userId } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      include: TRANSACTION_INCLUDE,
    });
  }

  async findCurrencyByCode(
    shortCode: string,
  ): Promise<PortfolioCurrency | null> {
    return this.prisma.currency.findUnique({
      where: { shortCode },
      ...CURRENCY,
    });
  }

  async findCurrency(currencyId: string): Promise<PortfolioCurrency | null> {
    return this.prisma.currency.findUnique({
      where: { id: currencyId },
      ...CURRENCY,
    });
  }

  // Um ativo de dinheiro por moeda, no catálogo partilhado; nasce da primeira vez
  async ensureCashAsset(currency: PortfolioCurrency) {
    return this.prisma.asset.upsert({
      where: { currencyId: currency.id },
      update: {},
      create: {
        assetClass: 'liquidity',
        subClass: 'cash',
        name: currency.name,
        ticker: currency.shortCode,
        currencyId: currency.id,
      },
      select: { id: true },
    });
  }

  async findUserBankAccount(userId: string, bankAccountId: string) {
    return this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, userId },
      select: { id: true, currencyId: true },
    });
  }
}
