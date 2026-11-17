import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Instrument, Prisma } from 'src/generated/prisma/client/client';
import {
  CatalogAssetInput,
  InstrumentFilters,
  InstrumentInput,
  InstrumentToPrice,
  MarketDataRepository,
  PriceSyncState,
  SharedAssetInput,
  PRICED_SOURCES,
  SIMULATOR_SOURCES,
  StockInstrumentInput,
} from '../market-data-repository';

const INSTRUMENT_LIST_SELECT = {
  id: true,
  source: true,
  type: true,
  symbol: true,
  quote: true,
  status: true,
  expiresAt: true,
  // O passo e os mínimos de cada ordem, para o simulador
  metadata: true,
  asset: { select: { ticker: true, name: true } },
  // O nome e o logótipo da corretora, das plataformas
  platform: { select: { name: true, logo: true } },
} as const;

const INSTRUMENT_ORDER: Prisma.InstrumentOrderByWithRelationInput[] = [
  { symbol: 'asc' },
  { type: 'asc' },
];

const DOWNLOAD_INCLUDE = {
  instrument: {
    select: { id: true, source: true, type: true, symbol: true, quote: true },
  },
} as const;

// createMany em lotes: a Binance tem milhares de pares e o Postgres limita
// o número de parâmetros por query
const BATCH = 1000;

@Injectable()
export class PrismaMarketDataRepository implements MarketDataRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCatalogAssets(tickers: string[]) {
    return this.prisma.asset.findMany({
      where: { ownerUserId: null, ticker: { in: tickers } },
      select: { id: true, subClass: true, ticker: true },
    });
  }

  async createCatalogAssets(assets: CatalogAssetInput[]) {
    let created = 0;
    for (let i = 0; i < assets.length; i += BATCH) {
      const result = await this.prisma.asset.createMany({
        data: assets.slice(i, i + BATCH),
      });
      created += result.count;
    }
    return created;
  }

  async findInstrumentsBySource(source: string) {
    return this.prisma.instrument.findMany({ where: { source } });
  }

  async createInstruments(instruments: InstrumentInput[]) {
    let created = 0;
    for (let i = 0; i < instruments.length; i += BATCH) {
      const result = await this.prisma.instrument.createMany({
        data: instruments.slice(i, i + BATCH).map((item) => ({
          ...item,
          metadata: item.metadata as Prisma.InputJsonValue,
        })),
        skipDuplicates: true,
      });
      created += result.count;
    }
    return created;
  }

  async updateInstrument(id: string, data: Partial<InstrumentInput>) {
    await this.prisma.instrument.update({
      where: { id },
      data: {
        ...data,
        metadata: data.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async markDelisted(ids: string[]) {
    if (ids.length === 0) return 0;
    const result = await this.prisma.instrument.updateMany({
      where: { id: { in: ids } },
      data: { status: 'delisted' },
    });
    return result.count;
  }

  // Leva as velas já marcadas (MarketDataMonth) e os pedidos desses mercados
  async deleteInstrumentsOutsideQuotes(source: string, quotes: string[]) {
    const result = await this.prisma.instrument.deleteMany({
      where: { source, quote: { notIn: quotes } },
    });
    return result.count;
  }

  // Ativos do catálogo que ficaram sem nenhum mercado
  // Os do catálogo que ficaram sem mercado; nunca o dinheiro de uma moeda nem um ativo
  // que esteja nalguma transação de um portefólio
  async deleteOrphanCatalogAssets() {
    const result = await this.prisma.asset.deleteMany({
      where: {
        ownerUserId: null,
        currencyId: null,
        instruments: { none: {} },
        portfolioTransactions: { none: {} },
      },
    });
    return result.count;
  }

  // Primeiro os que começam pelo texto (BTC: BTCUSDT antes de WBTCUSDT),
  // depois os que só o contêm
  async findInstruments(
    filters: InstrumentFilters,
    skip: number,
    take: number,
  ) {
    const base: Prisma.InstrumentWhereInput = {
      status: filters.status,
      source: filters.source && SIMULATOR_SOURCES.includes(filters.source)
        ? filters.source
        : { in: SIMULATOR_SOURCES },
      ...(filters.type && { type: filters.type }),
    };

    if (!filters.search) {
      const [items, total] = await Promise.all([
        this.prisma.instrument.findMany({
          where: base,
          select: INSTRUMENT_LIST_SELECT,
          orderBy: INSTRUMENT_ORDER,
          skip,
          take,
        }),
        this.prisma.instrument.count({ where: base }),
      ]);
      return { items, total };
    }

    const search = filters.search.toUpperCase();
    const starts: Prisma.InstrumentWhereInput = {
      ...base,
      symbol: { startsWith: search },
    };
    const contains: Prisma.InstrumentWhereInput = {
      ...base,
      AND: [
        { symbol: { contains: search } },
        { NOT: { symbol: { startsWith: search } } },
      ],
    };

    const [startsTotal, containsTotal] = await Promise.all([
      this.prisma.instrument.count({ where: starts }),
      this.prisma.instrument.count({ where: contains }),
    ]);

    const startsItems =
      skip < startsTotal
        ? await this.prisma.instrument.findMany({
            where: starts,
            select: INSTRUMENT_LIST_SELECT,
            orderBy: INSTRUMENT_ORDER,
            skip,
            take,
          })
        : [];

    const remaining = take - startsItems.length;
    const containsItems =
      remaining > 0
        ? await this.prisma.instrument.findMany({
            where: contains,
            select: INSTRUMENT_LIST_SELECT,
            orderBy: INSTRUMENT_ORDER,
            skip: Math.max(0, skip - startsTotal),
            take: remaining,
          })
        : [];

    return {
      items: [...startsItems, ...containsItems],
      total: startsTotal + containsTotal,
    };
  }

  async countInstrumentFacets(status: string) {
    const [sources, types, platforms] = await Promise.all([
      this.prisma.instrument.groupBy({
        by: ['source'],
        where: { status, source: { in: SIMULATOR_SOURCES } },
        _count: { _all: true },
      }),
      this.prisma.instrument.groupBy({
        by: ['type'],
        where: { status, source: { in: SIMULATOR_SOURCES } },
        _count: { _all: true },
      }),
      // Uma linha por corretora, com a plataforma a que os mercados dela estão ligados
      this.prisma.instrument.findMany({
        where: { status, platformId: { not: null } },
        distinct: ['source'],
        select: { source: true, platform: { select: { name: true, logo: true } } },
      }),
    ]);
    const platformBySource = new Map(platforms.map((item) => [item.source, item.platform]));

    return {
      sources: sources
        .map((item) => ({
          source: item.source,
          count: item._count._all,
          platform: platformBySource.get(item.source) ?? null,
        }))
        .sort((a, b) => b.count - a.count),
      types: types
        .map((item) => ({ type: item.type, count: item._count._all }))
        .sort((a, b) => b.count - a.count),
    };
  }

  async findInstrumentById(id: string): Promise<Instrument | null> {
    return this.prisma.instrument.findUnique({ where: { id } });
  }

  // A exchange pelo nome do catálogo (a CoinGecko mantém-no) ou pelo id na CoinGecko
  async findExchangePlatformId(name: string, coingeckoId: string) {
    const platform = await this.prisma.platform.findFirst({
      where: {
        type: 'exchange',
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { source: 'coingecko', externalId: coingeckoId },
        ],
      },
      orderBy: { isActive: 'desc' },
      select: { id: true },
    });
    return platform?.id ?? null;
  }

  async linkInstrumentsToPlatform(source: string, platformId: string) {
    const result = await this.prisma.instrument.updateMany({
      where: { source, OR: [{ platformId: null }, { platformId: { not: platformId } }] },
      data: { platformId },
    });
    return result.count;
  }

  async createDownload(data: {
    userId: string;
    instrumentId: string;
    fromDate: Date;
    toDate: Date;
    monthsTotal: number;
  }) {
    return this.prisma.marketDataDownload.create({
      data,
      include: DOWNLOAD_INCLUDE,
    });
  }

  async findDownload(id: string, userId: string) {
    return this.prisma.marketDataDownload.findFirst({
      where: { id, userId },
      include: DOWNLOAD_INCLUDE,
    });
  }

  // Acorda o downloader, que está à escuta deste canal (LISTEN)
  async notifyDownload(id: string) {
    await this.prisma
      .$executeRaw`SELECT pg_notify('market_data_download', ${id})`;
  }

  // --- as ações (Yahoo e corretoras) ---

  // Os mercados à vista de uma corretora de cripto que batem com o texto (o símbolo, o
  // ticker ou o nome do ativo), dos que se negoceiam
  async searchExchangeInstruments(source: string, query: string, take: number) {
    const text = { contains: query, mode: 'insensitive' as const };
    return this.prisma.instrument.findMany({
      where: {
        source,
        type: 'spot',
        status: 'trading',
        OR: [{ symbol: text }, { asset: { ticker: text } }, { asset: { name: text } }],
      },
      take,
      orderBy: { symbol: 'asc' },
      select: {
        id: true,
        source: true,
        symbol: true,
        quote: true,
        asset: { select: { id: true, name: true, ticker: true } },
        platform: { select: { id: true, name: true, logo: true } },
      },
    });
  }

  async findInstrumentBySymbol(source: string, type: string, symbol: string) {
    return this.prisma.instrument.findUnique({
      where: { source_type_symbol: { source, type, symbol } },
      select: { id: true, assetId: true },
    });
  }

  async findSharedAssetByIsin(isin: string) {
    return this.prisma.asset.findFirst({
      where: { isin, ownerUserId: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, ticker: true },
    });
  }

  // Uma ação do catálogo partilhado com este ticker e ainda sem ISIN (as dos futuros da Binance)
  async findSharedStockByTicker(ticker: string) {
    return this.prisma.asset.findFirst({
      where: { ticker, subClass: { in: ['stock', 'etf'] }, ownerUserId: null, isin: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, ticker: true },
    });
  }

  async updateAsset(id: string, data: { isin?: string; name?: string }) {
    await this.prisma.asset.update({ where: { id }, data });
  }

  async createAsset(data: SharedAssetInput) {
    return this.prisma.asset.create({ data, select: { id: true, name: true, ticker: true } });
  }

  async upsertInstrument(input: StockInstrumentInput) {
    const { metadata, ...data } = input;
    const json = metadata as Prisma.InputJsonValue | undefined;
    return this.prisma.instrument.upsert({
      where: { source_type_symbol: { source: data.source, type: data.type, symbol: data.symbol } },
      create: { ...data, metadata: json },
      update: { ...data, metadata: json },
      select: { id: true, assetId: true },
    });
  }

  // Os mercados que dão o preço a transações de um portefólio: os do Yahoo para onde
  // aponta um mercado de corretora com transações, e os do Yahoo, da Binance e da Coinbase
  // com transações deles (as compras à mão). Com `instrumentIds`, só os destes mercados
  // (os das transações ou eles próprios). Desde a primeira transação e o último dia guardado.
  async findInstrumentsToPrice(instrumentIds?: string[]): Promise<InstrumentToPrice[]> {
    const only = instrumentIds ? { id: { in: instrumentIds } } : {};
    const rows = await this.prisma.instrument.findMany({
      where: {
        OR: [
          { source: 'yahoo', pricedBy: { some: { ...only, transactions: { some: {} } } } },
          { source: { in: PRICED_SOURCES }, ...only, transactions: { some: {} } },
        ],
      },
      select: {
        id: true,
        source: true,
        type: true,
        symbol: true,
        pricedBy: {
          select: { transactions: { select: { date: true }, orderBy: { date: 'asc' }, take: 1 } },
        },
        transactions: { select: { date: true }, orderBy: { date: 'asc' }, take: 1 },
        metadata: true,
        prices: { select: { date: true }, orderBy: { date: 'desc' }, take: 1 },
      },
    });
    return rows.flatMap((row) => {
      const dates = [
        ...row.pricedBy.flatMap((broker) => broker.transactions.map((tx) => tx.date.getTime())),
        ...row.transactions.map((tx) => tx.date.getTime()),
      ];
      if (!dates.length) return [];
      return [
        {
          id: row.id,
          source: row.source,
          type: row.type,
          symbol: row.symbol,
          firstDate: new Date(Math.min(...dates)),
          lastDate: row.prices[0]?.date ?? null,
          metadata: (row.metadata as Record<string, unknown> | null) ?? null,
        },
      ];
    });
  }

  // Os fechos de um mercado: os dias novos entram, os que já estavam ficam com o valor novo
  // Os dias novos entram de uma vez; os de `refreshFrom` em diante (o último guardado e os
  // antes dele, que o Yahoo ainda pode corrigir) atualizam-se. Devolve os novos.
  async saveInstrumentPrices(
    instrumentId: string,
    days: { date: string; close: number; adjClose: number | null }[],
    refreshFrom: string | null,
  ) {
    const at = (day: string) => new Date(`${day}T00:00:00.000Z`);
    const refresh = refreshFrom ? days.filter((day) => day.date >= refreshFrom) : [];
    const [created] = await this.prisma.$transaction([
      this.prisma.instrumentPrice.createMany({
        data: days.map((day) => ({ instrumentId, date: at(day.date), close: day.close, adjClose: day.adjClose })),
        skipDuplicates: true,
      }),
      ...refresh.map((day) =>
        this.prisma.instrumentPrice.updateMany({
          where: { instrumentId, date: at(day.date) },
          data: { close: day.close, adjClose: day.adjClose },
        }),
      ),
    ]);
    return created.count;
  }

  // Guarda no metadata do mercado como correu a última volta dos preços
  async savePriceSyncState(instrumentId: string, metadata: Record<string, unknown> | null, state: PriceSyncState) {
    await this.prisma.instrument.update({
      where: { id: instrumentId },
      data: { metadata: { ...(metadata ?? {}), ...state } as Prisma.InputJsonValue },
    });
  }
}
