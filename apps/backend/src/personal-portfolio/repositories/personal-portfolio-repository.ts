import {
  BrokerConnection,
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
  connection: { fromDate: Date | null } | null;
  _count: { transactions: number };
};

/** Uma ligação a uma corretora como vai para o browser: sem a chave nem o segredo. */
export type BrokerConnectionView = Omit<BrokerConnection, 'apiKey' | 'apiSecret'> & {
  platform: { id: string; name: string; logo: string | null };
  portfolios: { id: string; name: string; externalId: string | null }[];
};

export type BrokerConnectionData = {
  userId: string;
  platformId: string;
  externalAccountId: string;
  currencyCode: string | null;
  apiKey: string;
  apiSecret: string;
  fromDate: Date | null;
};

/** Uma transação que vem de uma corretora (já com o ativo de dinheiro e a moeda). */
export type ImportedTransactionData = {
  portfolioId: string;
  assetId: string;
  kind: string;
  date: Date;
  quantity: number;
  price?: number | null;
  amount: number;
  instrumentId?: string | null;
  currencyId: string;
  externalId: string;
  externalType: string;
  externalAt: Date;
};

/** Um ativo de mercado (ação, ETF…) que vem de uma corretora. */
export type MarketAssetData = {
  name: string;
  isin: string;
  ticker: string | null;
  subClass: string;
};

// O relatório dos preços (`valuationReport`) só vem quando se pede um bem: nas listas e nas contas não
export type PortfolioTransactionWithRefs = Omit<PersonalPortfolioTransaction, 'valuationReport'> & {
  asset: { id: string; name: string; assetClass: string; subClass: string };
  currency: PortfolioCurrency;
  bankAccount: { id: string; name: string } | null;
  // O mercado onde foi (ações) e o de onde vem o preço
  instrument: {
    id: string;
    symbol: string;
    quote: string;
    source: string;
    type: string;
    priceInstrument: { id: string; symbol: string; quote: string; source: string; type: string } | null;
  } | null;
};

/** Um fecho diário de um mercado. */
export type InstrumentClose = { instrumentId: string; date: Date; close: number };

export type PortfolioTransactionListItem = PortfolioTransactionWithRefs & {
  portfolio: {
    id: string;
    name: string;
    source: string;
    platform: { id: string; name: string; logo: string | null } | null;
  };
};

export type PortfolioTransactionFilters = {
  portfolioId?: string;
  source?: string;
  platformId?: string;
  assetId?: string;
  kind?: string;
  from?: Date;
  to?: Date;
  // Os portefólios de uma ligação com `fromDate`: só desse dia em diante
  fromDates?: Map<string, Date>;
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
  // Nas compras e vendas (e no dinheiro delas): o mercado
  instrumentId?: string | null;
  // Nos bens: como se obteve, o relatório dos preços e `in_kind` (sem dinheiro ligado)
  acquisition?: string | null;
  valuationReport?: object | null;
  externalType?: string | null;
};

/** Um bem da pessoa (por agora as motas): o ativo com os detalhes e a atualização automática. */
export type GoodsAssetData = {
  ownerUserId: string;
  assetClass: string;
  subClass: string;
  name: string;
  details: object;
  valuationEveryDays: number | null;
  valuationNextAt: Date | null;
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
  findTransactionList(
    userId: string,
    filters: PortfolioTransactionFilters,
  ): Promise<PortfolioTransactionListItem[]>;
  findUserAssets(userId: string): Promise<{ id: string; name: string; subClass: string; ticker: string | null }[]>;
  findCurrency(currencyId: string): Promise<PortfolioCurrency | null>;
  findCurrencyByCode(shortCode: string): Promise<PortfolioCurrency | null>;
  ensureCashAsset(currency: PortfolioCurrency): Promise<{ id: string }>;
  findUserBankAccount(
    userId: string,
    bankAccountId: string,
  ): Promise<{ id: string; currencyId: string } | null>;

  findBrokerPlatform(name: string): Promise<{ id: string; name: string } | null>;
  findConnections(userId: string): Promise<BrokerConnectionView[]>;
  findConnectionView(userId: string, connectionId: string): Promise<BrokerConnectionView | null>;
  findConnection(connectionId: string): Promise<BrokerConnection | null>;
  findConnectionByAccount(
    userId: string,
    platformId: string,
    externalAccountId: string,
  ): Promise<BrokerConnection | null>;
  /** As ligações não pausadas, com a última sincronização e o intervalo (quem está em atraso vê-o o serviço). */
  findConnectionsToSync(): Promise<{ id: string; syncedAt: Date | null; syncEveryHours: number }[]>;
  createConnection(data: BrokerConnectionData): Promise<BrokerConnection>;
  updateConnection(
    connectionId: string,
    data: Partial<Omit<BrokerConnection, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<BrokerConnection>;
  deleteConnection(connectionId: string): Promise<void>;
  findConnectionPortfolio(connectionId: string, externalId: string): Promise<PersonalPortfolio | null>;
  findDetachedApiPortfolio(userId: string, platformId: string, externalId: string): Promise<PersonalPortfolio | null>;
  attachPortfolio(portfolioId: string, connectionId: string): Promise<PersonalPortfolio>;
  findOtherCurrencies(portfolioId: string, shortCode: string): Promise<PortfolioCurrency[]>;
  createApiPortfolio(data: {
    userId: string;
    name: string;
    platformId: string;
    externalId: string;
    connectionId: string;
  }): Promise<PersonalPortfolio>;
  createImportedTransactions(rows: ImportedTransactionData[]): Promise<number>;
  findPriceSeries(instrumentIds: string[]): Promise<InstrumentClose[]>;
  findLatestPrices(instrumentIds: string[]): Promise<InstrumentClose[]>;
  findKnownExternalIds(portfolioIds: string[], externalIds: string[]): Promise<Set<string>>;
  findAssetByIsin(isin: string): Promise<{ id: string } | null>;
  createMarketAsset(data: MarketAssetData): Promise<{ id: string }>;
  updateApiPortfolio(portfolioId: string, data: { name: string; externalId: string }): Promise<void>;
  moveTransactions(fromPortfolioId: string, toPortfolioId: string, currencyId: string): Promise<number>;
  markPortfolioSynced(portfolioId: string, syncedAt: Date): Promise<void>;
}
