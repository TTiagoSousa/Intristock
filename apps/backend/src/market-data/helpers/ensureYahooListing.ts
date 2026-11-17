import { BadRequestException } from '@nestjs/common';
import { PrismaMarketDataRepository } from '../repositories/prisma/prisma-market-data-repository';
import { sameCompany } from './ensureStockListing';
import { fetchYahooChart, searchYahoo, YahooQuote } from './yahooClient';

/**
 * O ativo e o mercado do Yahoo de um símbolo escolhido à mão (ASML.AS, AAPL, VWCE.DE),
 * criados da primeira vez. O ativo: o do catálogo com o mesmo ticker, se for a mesma
 * empresa (como nas ações da Trading 212), ou um novo. O mercado do Yahoo dá o preço a
 * ele próprio. Recusa um símbolo que o Yahoo não conheça.
 */
export async function ensureYahooListing(symbol: string, repository: PrismaMarketDataRepository) {
  const existing = await repository.findInstrumentBySymbol('yahoo', 'stock', symbol);
  if (existing) return { assetId: existing.assetId, instrumentId: existing.id };

  const chart = await fetchYahooChart(symbol).catch(() => null);
  if (!chart) throw new BadRequestException(`O Yahoo não conhece o símbolo ${symbol}`);
  const searched: YahooQuote[] = await searchYahoo(symbol).catch(() => []);
  const found = searched.find((quote) => quote.symbol === chart.symbol);
  const name = found?.name ?? chart.name ?? chart.symbol;
  const ticker = chart.symbol.split('.')[0];
  // Sem sufixo de bolsa, é uma bolsa americana
  const us = !chart.symbol.includes('.');

  const byTicker = await repository.findSharedStockByTicker(ticker);
  const asset =
    byTicker && sameCompany(byTicker, [name], us)
      ? byTicker
      : await repository.createAsset({
          assetClass: 'equity',
          subClass: found?.quoteType === 'ETF' ? 'etf' : 'stock',
          name,
          ticker,
          isin: null,
        });
  if (byTicker === asset && byTicker.name === byTicker.ticker) await repository.updateAsset(asset.id, { name });

  const instrument = await repository.upsertInstrument({
    assetId: asset.id,
    source: 'yahoo',
    type: 'stock',
    symbol: chart.symbol,
    venue: chart.exchange,
    quote: chart.currency,
    status: 'trading',
  });
  return { assetId: asset.id, instrumentId: instrument.id };
}
