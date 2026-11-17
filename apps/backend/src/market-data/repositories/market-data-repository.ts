import {
  Instrument,
  MarketDataDownload,
} from 'src/generated/prisma/client/client';

export interface CatalogAssetInput {
  id: string;
  assetClass: string;
  subClass: string;
  name: string;
  ticker: string;
}

export interface InstrumentInput {
  assetId: string;
  source: string;
  type: string;
  symbol: string;
  quote: string;
  status: string;
  expiresAt: Date | null;
  metadata: Record<string, unknown>;
}

/** Um mercado de ações (do Yahoo ou de uma corretora), criado ou atualizado pelo símbolo. */
export interface StockInstrumentInput {
  assetId: string;
  source: string;
  type: string;
  symbol: string;
  venue: string | null;
  quote: string;
  status: string;
  platformId?: string | null;
  priceInstrumentId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Um ativo do catálogo partilhado (as ações que vêm das corretoras). */
export interface SharedAssetInput {
  assetClass: string;
  subClass: string;
  name: string;
  ticker: string | null;
  isin: string;
}

/** Um mercado do Yahoo a pôr em dia: desde quando é preciso e o último dia guardado. */
export interface InstrumentToPrice {
  id: string;
  symbol: string;
  firstDate: Date;
  lastDate: Date | null;
  // O que já lá está (o estado das voltas fica junto: priceSyncedAt, priceError…)
  metadata: Record<string, unknown> | null;
}

/** Como correu a última volta dos preços de um mercado do Yahoo (no metadata dele). */
export interface PriceSyncState {
  priceSyncedAt?: string;
  priceError?: string | null;
  priceErrorAt?: string | null;
}

// As fontes que o simulador sabe usar (as velas vêm delas); as outras (Yahoo, as
// corretoras de ações) são só para os preços dos portefólios
export const SIMULATOR_SOURCES = ['binance', 'coinbase'];

export interface InstrumentFilters {
  search?: string;
  source?: string;
  type?: string;
  status: string;
}

export type InstrumentPlatform = { name: string; logo: string | null } | null;

export type InstrumentListItem = Pick<
  Instrument,
  'id' | 'source' | 'type' | 'symbol' | 'quote' | 'status' | 'expiresAt'
> & { asset: { ticker: string | null; name: string }; platform: InstrumentPlatform };

export type MarketDataDownloadView = MarketDataDownload & {
  instrument: Pick<Instrument, 'id' | 'source' | 'type' | 'symbol' | 'quote'>;
};

export interface MarketDataRepository {
  findCatalogAssets(
    tickers: string[],
  ): Promise<{ id: string; subClass: string; ticker: string | null }[]>;
  createCatalogAssets(assets: CatalogAssetInput[]): Promise<number>;
  findInstrumentsBySource(source: string): Promise<Instrument[]>;
  createInstruments(instruments: InstrumentInput[]): Promise<number>;
  updateInstrument(id: string, data: Partial<InstrumentInput>): Promise<void>;
  markDelisted(ids: string[]): Promise<number>;
  deleteInstrumentsOutsideQuotes(
    source: string,
    quotes: string[],
  ): Promise<number>;
  deleteOrphanCatalogAssets(): Promise<number>;
  findInstruments(
    filters: InstrumentFilters,
    skip: number,
    take: number,
  ): Promise<{ items: InstrumentListItem[]; total: number }>;
  countInstrumentFacets(status: string): Promise<{
    sources: { source: string; count: number; platform: InstrumentPlatform }[];
    types: { type: string; count: number }[];
  }>;
  findInstrumentById(id: string): Promise<Instrument | null>;
  findExchangePlatformId(name: string, coingeckoId: string): Promise<string | null>;
  linkInstrumentsToPlatform(source: string, platformId: string): Promise<number>;
  createDownload(data: {
    userId: string;
    instrumentId: string;
    fromDate: Date;
    toDate: Date;
    monthsTotal: number;
  }): Promise<MarketDataDownloadView>;
  findDownload(
    id: string,
    userId: string,
  ): Promise<MarketDataDownloadView | null>;
  notifyDownload(id: string): Promise<void>;
}
