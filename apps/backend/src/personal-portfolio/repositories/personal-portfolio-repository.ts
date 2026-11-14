import {
  PersonalPortfolio,
  PersonalPortfolioTransaction,
} from 'src/generated/prisma/client/client';

export type PortfolioCurrency = {
  id: string;
  name: string;
  shortCode: string;
  symbol: string;
  rate: number;
};

export type PortfolioWithCount = PersonalPortfolio & {
  platform: { id: string; name: string; logo: string | null } | null;
  _count: { transactions: number };
};

export type PortfolioTransactionWithRefs = PersonalPortfolioTransaction & {
  asset: { id: string; name: string; assetClass: string; subClass: string };
  currency: PortfolioCurrency;
  bankAccount: { id: string; name: string } | null;
};

export type PortfolioTransactionData = {
  portfolioId: string;
  assetId: string;
  kind: string;
  date: Date;
  quantity: number;
  price: number | null;
  amount: number;
  currencyId: string;
  bankAccountId: string | null;
  notes: string | null;
};

export interface PersonalPortfolioRepository {
  findPortfolios(userId: string): Promise<PortfolioWithCount[]>;
  findPortfolio(
    userId: string,
    portfolioId: string,
  ): Promise<PersonalPortfolio | null>;
  findPortfolioByName(
    userId: string,
    name: string,
  ): Promise<PersonalPortfolio | null>;
  createPortfolio(userId: string, name: string): Promise<PersonalPortfolio>;

  findTransactions(
    portfolioId: string,
  ): Promise<PortfolioTransactionWithRefs[]>;
  createTransaction(
    data: PortfolioTransactionData,
  ): Promise<PortfolioTransactionWithRefs>;

  findUserTransactions(userId: string): Promise<PortfolioTransactionWithRefs[]>;
  findCurrency(currencyId: string): Promise<PortfolioCurrency | null>;
  findCurrencyByCode(shortCode: string): Promise<PortfolioCurrency | null>;
  ensureCashAsset(currency: PortfolioCurrency): Promise<{ id: string }>;
  findUserBankAccount(
    userId: string,
    bankAccountId: string,
  ): Promise<{ id: string; currencyId: string } | null>;
}
