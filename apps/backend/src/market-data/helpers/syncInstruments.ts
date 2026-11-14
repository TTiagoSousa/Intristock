import { randomUUID } from 'node:crypto';
import { PrismaMarketDataRepository } from '../repositories/prisma/prisma-market-data-repository';
import {
  CatalogAssetInput,
  InstrumentInput,
} from '../repositories/market-data-repository';

// Um mercado como a corretora o dá, já no formato do catálogo
export interface RemoteInstrument {
  ticker: string;
  assetClass: string;
  subClass: string;
  type: 'spot' | 'perpetual' | 'future';
  symbol: string;
  quote: string;
  status: 'trading' | 'halted' | 'delisted';
  expiresAt: Date | null;
  metadata: Record<string, unknown>;
}

const assetKey = (subClass: string, ticker: string) => `${subClass}|${ticker}`;
const instrumentKey = (type: string, symbol: string) => `${type}|${symbol}`;

/**
 * Traz para o catálogo os mercados de uma corretora (`source`: a Binance, spot
 * e futuros USDⓈ-M; a Coinbase, spot), já lidos dela (`remote`).
 *
 * Cada moeda base passa a um Asset partilhado entre corretoras (o BTC é um só)
 * e cada par a um Instrument. Corre no arranque e uma vez por dia: cria o que é
 * novo, atualiza o estado do que mudou e marca como retirado o que a corretora
 * deixou de listar.
 */
export async function syncInstruments(
  repository: PrismaMarketDataRepository,
  source: string,
  remote: RemoteInstrument[],
  quotes: string[],
) {
  // Mercados de cotações que deixaram de interessar saem de vez (não estão
  // retirados da corretora, só fora do catálogo)
  const removed = await repository.deleteInstrumentsOutsideQuotes(
    source,
    quotes,
  );

  // 1. Um Asset por moeda/ação, só dos que ainda não existem
  const tickers = [...new Set(remote.map((item) => item.ticker))];
  const existingAssets = await repository.findCatalogAssets(tickers);
  const assetIds = new Map(
    existingAssets.map((asset) => [
      assetKey(asset.subClass, asset.ticker ?? ''),
      asset.id,
    ]),
  );

  const newAssets: CatalogAssetInput[] = [];
  for (const item of remote) {
    const key = assetKey(item.subClass, item.ticker);
    if (assetIds.has(key)) continue;
    const id = randomUUID();
    assetIds.set(key, id);
    newAssets.push({
      id,
      assetClass: item.assetClass,
      subClass: item.subClass,
      name: item.ticker,
      ticker: item.ticker,
    });
  }
  const assetsCreated = await repository.createCatalogAssets(newAssets);

  // 2. Instrumentos: novos, alterados e desaparecidos
  const existing = await repository.findInstrumentsBySource(source);
  const byKey = new Map(
    existing.map((item) => [instrumentKey(item.type, item.symbol), item]),
  );
  const seen = new Set<string>();

  const toCreate: InstrumentInput[] = [];
  let updated = 0;

  for (const item of remote) {
    const key = instrumentKey(item.type, item.symbol);
    seen.add(key);

    const data: InstrumentInput = {
      assetId: assetIds.get(assetKey(item.subClass, item.ticker))!,
      source,
      type: item.type,
      symbol: item.symbol,
      quote: item.quote,
      status: item.status,
      expiresAt: item.expiresAt,
      metadata: item.metadata,
    };

    const current = byKey.get(key);
    if (!current) {
      toCreate.push(data);
      continue;
    }

    const changed =
      current.status !== data.status ||
      current.quote !== data.quote ||
      current.assetId !== data.assetId ||
      (current.expiresAt?.getTime() ?? null) !==
        (data.expiresAt?.getTime() ?? null);

    if (changed) {
      await repository.updateInstrument(current.id, data);
      updated++;
    }
  }

  const created = await repository.createInstruments(toCreate);

  const gone = existing
    .filter(
      (item) =>
        item.status !== 'delisted' &&
        !seen.has(instrumentKey(item.type, item.symbol)),
    )
    .map((item) => item.id);
  const delisted = await repository.markDelisted(gone);
  const assetsRemoved = await repository.deleteOrphanCatalogAssets();

  return {
    assetsCreated,
    assetsRemoved,
    created,
    updated,
    delisted,
    removed,
    total: remote.length,
  };
}
