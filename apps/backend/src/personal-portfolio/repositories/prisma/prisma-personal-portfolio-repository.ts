import { latestRateHour } from 'src/currency/helpers/latestRateHour';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BrokerConnection, PersonalPortfolio, Prisma } from 'src/generated/prisma/client/client';
import {
  BrokerConnectionData,
  BrokerConnectionView,
  GoodsAssetData,
  ImportedTransactionData,
  InstrumentClose,
  MarketAssetData,
  PersonalPortfolioRepository,
  PortfolioTransactionFilters,
  PortfolioTransactionListItem,
  PortfolioCurrency,
  PortfolioTransactionData,
  PortfolioTransactionWithRefs,
  PortfolioWithCount,
} from '../personal-portfolio-repository';

const CURRENCY = {
  select: { id: true, name: true, shortCode: true, symbol: true, rate: true },
};

// As listas e as contas não levam o relatório dos preços (pode ter dezenas de anúncios)
const NO_REPORT = { valuationReport: true } as const;

const TRANSACTION_INCLUDE = {
  asset: {
    select: { id: true, name: true, assetClass: true, subClass: true },
  },
  currency: CURRENCY,
  bankAccount: { select: { id: true, name: true } },
  instrument: {
    select: {
      id: true,
      symbol: true,
      quote: true,
      source: true,
      type: true,
      priceInstrument: { select: { id: true, symbol: true, quote: true, source: true, type: true } },
    },
  },
};

// Uma ligação sem a chave nem o segredo
const CONNECTION_VIEW = {
  omit: { apiKey: true, apiSecret: true },
  include: {
    platform: { select: { id: true, name: true, logo: true } },
    portfolios: {
      select: { id: true, name: true, externalId: true },
      orderBy: { name: 'asc' as const },
    },
  },
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
        connection: { select: { fromDate: true } },
        _count: { select: { transactions: true } },
      },
    });
  }

  // Um portefólio como na lista (a plataforma, o `fromDate` da ligação, quantas transações)
  async findPortfolioView(userId: string, portfolioId: string): Promise<PortfolioWithCount | null> {
    return this.prisma.personalPortfolio.findFirst({
      where: { id: portfolioId, userId },
      include: {
        platform: { select: { id: true, name: true, logo: true } },
        connection: { select: { fromDate: true } },
        _count: { select: { transactions: true } },
      },
    });
  }

  /**
   * O que muda quando o resumo da pessoa pode mudar: as transações (quantas e a última
   * mexida), os portefólios e as ligações (nomes, `fromDate`) e a hora de cotações mais
   * recente. Os fechos das ações têm a versão deles, no `StockPriceService`.
   */
  async findSummaryVersion(userId: string): Promise<string> {
    const [transactions, portfolios, connections, hour] = await Promise.all([
      this.prisma.personalPortfolioTransaction.aggregate({
        where: { portfolio: { userId } },
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
      this.prisma.personalPortfolio.aggregate({
        where: { userId },
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
      this.prisma.brokerConnection.aggregate({ where: { userId }, _max: { updatedAt: true } }),
      latestRateHour(this.prisma),
    ]);
    return [
      transactions._count._all,
      transactions._max.updatedAt?.getTime() ?? 0,
      portfolios._count._all,
      portfolios._max.updatedAt?.getTime() ?? 0,
      connections._max.updatedAt?.getTime() ?? 0,
      hour?.getTime() ?? 0,
    ].join(':');
  }

  async findCurrenciesByCodes(shortCodes: string[]): Promise<PortfolioCurrency[]> {
    if (!shortCodes.length) return [];
    return this.prisma.currency.findMany({ where: { shortCode: { in: shortCodes } }, ...CURRENCY });
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

  // Com `fromDate` (a de uma ligação), só desse dia em diante
  async findTransactions(
    portfolioId: string,
    fromDate?: Date | null,
  ): Promise<PortfolioTransactionWithRefs[]> {
    return this.prisma.personalPortfolioTransaction.findMany({
      where: { portfolioId, ...(fromDate ? { date: { gte: fromDate } } : {}) },
      orderBy: [{ date: 'desc' }, { externalAt: 'desc' }, { createdAt: 'desc' }],
      omit: NO_REPORT,
      include: TRANSACTION_INCLUDE,
    });
  }

  async createTransaction(
    data: PortfolioTransactionData,
  ): Promise<PortfolioTransactionWithRefs> {
    return this.prisma.personalPortfolioTransaction.create({
      data: {
        ...data,
        valuationReport: (data.valuationReport ?? undefined) as Prisma.InputJsonValue | undefined,
        // A hora das cotações com que se converte (a mais recente guardada)
        rateHour: await latestRateHour(this.prisma),
      },
      omit: NO_REPORT,
      include: TRANSACTION_INCLUDE,
    });
  }

  // Várias de uma vez (uma compra e o dinheiro dela): ou entram todas ou nenhuma
  async createTransactions(rows: PortfolioTransactionData[]): Promise<PortfolioTransactionWithRefs[]> {
    const rateHour = await latestRateHour(this.prisma);
    return this.prisma.$transaction(
      rows.map((data) =>
        this.prisma.personalPortfolioTransaction.create({
          data: { ...data, valuationReport: (data.valuationReport ?? undefined) as Prisma.InputJsonValue | undefined, rateHour },
          omit: NO_REPORT,
          include: TRANSACTION_INCLUDE,
        }),
      ),
    );
  }

  // As transações de um mercado num portefólio que mexem na quantidade (para ver o que se tem)
  async findPositionTransactions(portfolioId: string, instrumentId: string) {
    return this.prisma.personalPortfolioTransaction.findMany({
      where: { portfolioId, instrumentId, kind: { in: ['buy', 'sell', 'adjust'] } },
      select: { kind: true, quantity: true, date: true, externalAt: true, createdAt: true },
    });
  }

  // Todas as transações da pessoa, da mais antiga à mais recente (o resumo soma-as por ordem)
  async findUserTransactions(
    userId: string,
  ): Promise<PortfolioTransactionWithRefs[]> {
    return this.prisma.personalPortfolioTransaction.findMany({
      where: { portfolio: { userId } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      omit: NO_REPORT,
      include: TRANSACTION_INCLUDE,
    });
  }

  // Os filtros da lista, já com o `fromDate` de cada portefólio de uma ligação (só desse dia)
  private transactionWhere(userId: string, filters: PortfolioTransactionFilters) {
    const fromDates = [...(filters.fromDates ?? new Map<string, Date>()).entries()];
    return {
      portfolio: {
        userId,
        ...(filters.source ? { source: filters.source } : {}),
        ...(filters.platformId ? { platformId: filters.platformId } : {}),
      },
      ...(filters.portfolioId ? { portfolioId: filters.portfolioId } : {}),
      ...(filters.assetId ? { assetId: filters.assetId } : {}),
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.from || filters.to
        ? {
            date: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
      ...(fromDates.length
        ? {
            OR: [
              { portfolioId: { notIn: fromDates.map(([id]) => id) } },
              ...fromDates.map(([portfolioId, from]) => ({ portfolioId, date: { gte: from } })),
            ],
          }
        : {}),
    };
  }

  async countTransactionList(userId: string, filters: PortfolioTransactionFilters): Promise<number> {
    return this.prisma.personalPortfolioTransaction.count({ where: this.transactionWhere(userId, filters) });
  }

  // Só o que é preciso para somar o dinheiro de todas as da lista (o tipo, o valor, a moeda, o dia)
  async findTransactionListAmounts(userId: string, filters: PortfolioTransactionFilters) {
    return this.prisma.personalPortfolioTransaction.findMany({
      where: this.transactionWhere(userId, filters),
      select: { kind: true, amount: true, date: true, currency: CURRENCY },
    });
  }

  // As transações da pessoa com os filtros, das mais recentes, com o portefólio de cada
  // uma; com `page`, só essa página
  async findTransactionList(
    userId: string,
    filters: PortfolioTransactionFilters,
    page?: { skip: number; take: number },
  ): Promise<PortfolioTransactionListItem[]> {
    return this.prisma.personalPortfolioTransaction.findMany({
      where: this.transactionWhere(userId, filters),
      ...(page ? { skip: page.skip, take: page.take } : {}),
      orderBy: [{ date: 'desc' }, { externalAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      omit: NO_REPORT,
      include: {
        ...TRANSACTION_INCLUDE,
        portfolio: {
          select: {
            id: true,
            name: true,
            source: true,
            platform: { select: { id: true, name: true, logo: true } },
          },
        },
      },
    });
  }

  // Os ativos que a pessoa tem nalguma transação (para o filtro)
  async findUserAssets(userId: string) {
    return this.prisma.asset.findMany({
      where: { portfolioTransactions: { some: { portfolio: { userId } } } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, subClass: true, ticker: true },
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
  // --- bens (as motas): o ativo da pessoa, as transações dele com os relatórios ---

  async createGoodsAsset(data: GoodsAssetData) {
    return this.prisma.asset.create({ data, select: { id: true } });
  }

  async findGoodsAsset(userId: string, assetId: string) {
    return this.prisma.asset.findFirst({
      where: { id: assetId, ownerUserId: userId, details: { not: Prisma.DbNull } },
      select: {
        id: true,
        name: true,
        assetClass: true,
        subClass: true,
        details: true,
        valuationEveryDays: true,
        valuationNextAt: true,
        createdAt: true,
      },
    });
  }

  async updateGoodsAsset(
    assetId: string,
    data: Partial<Pick<GoodsAssetData, 'name' | 'details' | 'valuationEveryDays' | 'valuationNextAt'>>,
  ) {
    return this.prisma.asset.update({ where: { id: assetId }, data, select: { id: true } });
  }

  // As transações de um bem, das mais antigas, com os relatórios
  async findGoodsTransactions(userId: string, assetId: string) {
    return this.prisma.personalPortfolioTransaction.findMany({
      where: { assetId, portfolio: { userId } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      include: { currency: CURRENCY, portfolio: { select: { id: true, name: true } } },
    });
  }

  // Os bens com a atualização automática vencida, dos mais atrasados
  async findDueGoods(now: Date, take: number) {
    return this.prisma.asset.findMany({
      where: { valuationEveryDays: { not: null }, valuationNextAt: { lte: now }, ownerUserId: { not: null } },
      orderBy: { valuationNextAt: 'asc' },
      take,
      select: { id: true, ownerUserId: true },
    });
  }

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

  async findBrokerPlatform(name: string) {
    return this.prisma.platform.findFirst({
      where: { type: 'broker', name: { equals: name, mode: 'insensitive' } },
      orderBy: { isActive: 'desc' },
      select: { id: true, name: true },
    });
  }

  async findConnections(userId: string): Promise<BrokerConnectionView[]> {
    return this.prisma.brokerConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      ...CONNECTION_VIEW,
    });
  }

  async findConnectionView(
    userId: string,
    connectionId: string,
  ): Promise<BrokerConnectionView | null> {
    return this.prisma.brokerConnection.findFirst({
      where: { id: connectionId, userId },
      ...CONNECTION_VIEW,
    });
  }

  async findConnection(connectionId: string): Promise<BrokerConnection | null> {
    return this.prisma.brokerConnection.findUnique({ where: { id: connectionId } });
  }

  async findConnectionByAccount(userId: string, platformId: string, externalAccountId: string) {
    return this.prisma.brokerConnection.findUnique({
      where: { userId_platformId_externalAccountId: { userId, platformId, externalAccountId } },
    });
  }

  // As que não estão em pausa e não se sincronizam desde `syncedBefore` (ou nunca)
  async findConnectionsToSync() {
    return this.prisma.brokerConnection.findMany({
      where: { status: { not: 'paused' } },
      orderBy: { syncedAt: { sort: 'asc', nulls: 'first' } },
      select: { id: true, syncedAt: true, syncEveryHours: true },
    });
  }

  async createConnection(data: BrokerConnectionData): Promise<BrokerConnection> {
    return this.prisma.brokerConnection.create({ data });
  }

  async updateConnection(
    connectionId: string,
    data: Partial<Omit<BrokerConnection, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<BrokerConnection> {
    return this.prisma.brokerConnection.update({ where: { id: connectionId }, data });
  }

  // Os portefólios ficam, soltos: soltam-se aqui (e não pelo `SetNull` da base) para o
  // `updatedAt` deles mudar e o resumo em cache se refazer
  async deleteConnection(connectionId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.personalPortfolio.updateMany({ where: { connectionId }, data: { connectionId: null } }),
      this.prisma.brokerConnection.delete({ where: { id: connectionId } }),
    ]);
  }

  async findConnectionPortfolio(connectionId: string, externalId: string) {
    return this.prisma.personalPortfolio.findFirst({ where: { connectionId, externalId } });
  }

  // Um portefólio de uma ligação que já foi apagada (a mesma conta na mesma corretora)
  async findDetachedApiPortfolio(userId: string, platformId: string, externalId: string) {
    return this.prisma.personalPortfolio.findFirst({
      where: { userId, platformId, externalId, source: 'api', connectionId: null },
    });
  }

  async attachPortfolio(portfolioId: string, connectionId: string): Promise<PersonalPortfolio> {
    return this.prisma.personalPortfolio.update({ where: { id: portfolioId }, data: { connectionId } });
  }

  // As moedas das transações de um portefólio que não são esta
  async findOtherCurrencies(portfolioId: string, shortCode: string): Promise<PortfolioCurrency[]> {
    const rows = await this.prisma.personalPortfolioTransaction.findMany({
      where: { portfolioId, currency: { shortCode: { not: shortCode } } },
      distinct: ['currencyId'],
      select: { currency: CURRENCY },
    });
    return rows.map((row) => row.currency);
  }

  async createApiPortfolio(data: {
    userId: string;
    name: string;
    platformId: string;
    externalId: string;
    connectionId: string;
  }): Promise<PersonalPortfolio> {
    return this.prisma.personalPortfolio.create({ data: { ...data, source: 'api' } });
  }

  // As importadas não levam `rateHour`: são do passado e convertem pela cotação do dia
  // delas. As que já estão (o mesmo `externalId` no portefólio) ficam como estão.
  async createImportedTransactions(rows: ImportedTransactionData[]): Promise<number> {
    if (!rows.length) return 0;
    const result = await this.prisma.personalPortfolioTransaction.createMany({
      data: rows.map((row) => ({ ...row, price: row.price ?? null })),
      skipDuplicates: true,
    });
    return result.count;
  }

  // Os fechos de cada dia destes mercados, do mais antigo
  async findPriceSeries(instrumentIds: string[]): Promise<InstrumentClose[]> {
    if (!instrumentIds.length) return [];
    const rows = await this.prisma.instrumentPrice.findMany({
      where: { instrumentId: { in: instrumentIds } },
      orderBy: { date: 'asc' },
      select: { instrumentId: true, date: true, close: true },
    });
    return rows.map((row) => ({ ...row, close: Number(row.close) }));
  }

  // O último fecho guardado de cada um destes mercados
  async findLatestPrices(instrumentIds: string[]): Promise<InstrumentClose[]> {
    if (!instrumentIds.length) return [];
    const rows = await this.prisma.instrumentPrice.findMany({
      where: { instrumentId: { in: instrumentIds } },
      orderBy: [{ instrumentId: 'asc' }, { date: 'desc' }],
      distinct: ['instrumentId'],
      select: { instrumentId: true, date: true, close: true },
    });
    return rows.map((row) => ({ ...row, close: Number(row.close) }));
  }

  // Dos `externalIds`, os que já estão nalgum destes portefólios
  async findKnownExternalIds(portfolioIds: string[], externalIds: string[]) {
    if (!externalIds.length) return new Set<string>();
    const rows = await this.prisma.personalPortfolioTransaction.findMany({
      where: { portfolioId: { in: portfolioIds }, externalId: { in: externalIds } },
      select: { externalId: true },
    });
    return new Set(rows.map((row) => row.externalId!));
  }

  // O ativo do catálogo partilhado com este ISIN (o primeiro, se houver mais)
  async findAssetByIsin(isin: string) {
    return this.prisma.asset.findFirst({
      where: { isin, ownerUserId: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
  }

  async createMarketAsset(data: MarketAssetData) {
    return this.prisma.asset.create({
      data: { ...data, assetClass: 'equity' },
      select: { id: true },
    });
  }

  async updateApiPortfolio(portfolioId: string, data: { name: string; externalId: string }) {
    await this.prisma.personalPortfolio.update({ where: { id: portfolioId }, data });
  }

  // Passa as transações de uma moeda de um portefólio para outro. As que o outro já tem (o
  // mesmo `externalId`, importadas de novo depois de uma passagem a meio) saem daqui
  async moveTransactions(fromPortfolioId: string, toPortfolioId: string, currencyId: string) {
    return this.prisma.$transaction(async (tx) => {
      const known = await tx.personalPortfolioTransaction.findMany({
        where: { portfolioId: toPortfolioId, externalId: { not: null } },
        select: { externalId: true },
      });
      const duplicated = known.map((row) => row.externalId!);
      if (duplicated.length)
        await tx.personalPortfolioTransaction.deleteMany({
          where: { portfolioId: fromPortfolioId, currencyId, externalId: { in: duplicated } },
        });
      const result = await tx.personalPortfolioTransaction.updateMany({
        where: { portfolioId: fromPortfolioId, currencyId },
        data: { portfolioId: toPortfolioId },
      });
      return result.count;
    });
  }

  async markPortfolioSynced(portfolioId: string, syncedAt: Date): Promise<void> {
    await this.prisma.personalPortfolio.update({ where: { id: portfolioId }, data: { syncedAt } });
  }
}
