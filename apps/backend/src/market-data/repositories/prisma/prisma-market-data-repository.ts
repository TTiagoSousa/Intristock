import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Instrument, Prisma } from 'src/generated/prisma/client/client';
import {
  CatalogAssetInput,
  InstrumentFilters,
  InstrumentInput,
  MarketDataRepository,
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
  async deleteOrphanCatalogAssets() {
    const result = await this.prisma.asset.deleteMany({
      where: { ownerUserId: null, instruments: { none: {} } },
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
      ...(filters.source && { source: filters.source }),
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
        where: { status },
        _count: { _all: true },
      }),
      this.prisma.instrument.groupBy({
        by: ['type'],
        where: { status },
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
}
