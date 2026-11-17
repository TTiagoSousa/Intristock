import { PrismaMarketDataRepository } from '../repositories/prisma/prisma-market-data-repository';
import { fetchYahooChart, normalizeCurrency, searchYahoo, YahooChart } from './yahooClient';

/** Uma ação como a corretora a dá: o ticker dela, o ISIN, o nome e a moeda em que negoceia. */
export type BrokerStock = {
  source: string; // 'trading212'
  platformId: string | null;
  symbol: string; // 'CCC3d_EQ'
  isin: string;
  name: string;
  currency: string; // 'EUR'
};

// O sufixo da bolsa nos tickers da Trading 212 (CCC3d_EQ → CCC3 em Xetra) → o do Yahoo.
// Os que não estão aqui encontram-se pela pesquisa do ISIN.
const TRADING212_SUFFIX: Record<string, string> = { d: '.DE', a: '.AS', p: '.PA', l: '.L', m: '.MI', e: '.MC' };

// Os símbolos a experimentar no Yahoo, do mais provável: o que o ticker diz e os da pesquisa
function candidates(stock: BrokerStock, searched: string[]) {
  const list: string[] = [];
  const us = /^(.+)_US_EQ$/.exec(stock.symbol);
  const local = /^([A-Z0-9.]+?)([a-z])_EQ$/.exec(stock.symbol);
  if (us) list.push(us[1].replace(/\./g, '-'));
  else if (local && TRADING212_SUFFIX[local[2]]) list.push(local[1] + TRADING212_SUFFIX[local[2]]);
  for (const symbol of searched) if (!list.includes(symbol)) list.push(symbol);
  return list;
}

// O ticker da empresa, igual em todo o lado: o da bolsa americana se houver (KO), senão o
// da primeira bolsa sem o sufixo (ASML.AS → ASML). `us` diz se veio de uma bolsa americana.
function companyTicker(searched: { symbol: string }[], fallback: string) {
  const plain = searched.find((quote) => !quote.symbol.includes('.'));
  return { ticker: (plain?.symbol ?? searched[0]?.symbol ?? fallback).split('.')[0], us: Boolean(plain) };
}

// As palavras que não distinguem empresas (a forma jurídica, "the", "holding")
const NAME_NOISE = new Set([
  'the', 'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'companies', 'ltd', 'limited',
  'plc', 'nv', 'sa', 'se', 'ag', 'spa', 'ab', 'asa', 'as', 'oyj', 'holding', 'holdings', 'group', 'class', 'cl',
]);
const nameWords = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word && !NAME_NOISE.has(word));

/**
 * Se um ativo do catálogo encontrado só pelo ticker é a mesma empresa: com um nome
 * a sério, as palavras que contam têm de bater (uma contém a outra); com o nome igual
 * ao ticker (os futuros de ações da Binance, que são de empresas americanas), só se o
 * ticker veio de uma bolsa americana.
 */
function sameCompany(catalog: { name: string; ticker: string | null }, names: string[], us: boolean) {
  if (catalog.name === catalog.ticker) return us;
  const mine = nameWords(catalog.name).join(' ');
  if (!mine) return us;
  return names.some((name) => {
    const theirs = nameWords(name).join(' ');
    return Boolean(theirs) && (theirs.includes(mine) || mine.includes(theirs));
  });
}

/**
 * O ativo e o mercado de uma ação de uma corretora, criados da primeira vez: o ativo é
 * um só por empresa (pelo ISIN ou, num do catálogo sem ele, pelo ticker — o KO dos
 * futuros da Binance é a mesma Coca-Cola), e o mercado da corretora aponta para o do
 * Yahoo na mesma moeda, de onde vêm os preços. Sem mercado no Yahoo fica sem preço.
 */
export async function ensureStockListing(stock: BrokerStock, repository: PrismaMarketDataRepository) {
  const existing = await repository.findInstrumentBySymbol(stock.source, 'stock', stock.symbol);
  if (existing) return { assetId: existing.assetId, instrumentId: existing.id };

  const searched = await searchYahoo(stock.isin).catch(() => []);
  let chart: YahooChart | null = null;
  for (const symbol of candidates(stock, searched.map((quote) => quote.symbol))) {
    const found = await fetchYahooChart(symbol).catch(() => null);
    if (found && found.currency === normalizeCurrency(stock.currency)) {
      chart = found;
      break;
    }
  }
  const { ticker, us } = companyTicker(searched, stock.symbol.split('_')[0]);
  const name = searched[0]?.name ?? chart?.name ?? stock.name;
  const subClass = searched[0]?.quoteType === 'ETF' ? 'etf' : 'stock';

  // O ativo: pelo ISIN, senão pelo ticker num do catálogo que ainda não tenha ISIN e que
  // seja a mesma empresa (o mesmo ticker pode ser outra empresa noutra bolsa)
  let asset = await repository.findSharedAssetByIsin(stock.isin);
  if (!asset) {
    const byTicker = await repository.findSharedStockByTicker(ticker);
    const names = [stock.name, ...searched.map((quote) => quote.name), ...(chart?.name ? [chart.name] : [])];
    if (byTicker && sameCompany(byTicker, names, us)) {
      // O nome do catálogo da Binance é o ticker; fica o da empresa
      await repository.updateAsset(byTicker.id, {
        isin: stock.isin,
        ...(byTicker.name === byTicker.ticker ? { name } : {}),
      });
      asset = byTicker;
    }
  }
  if (!asset)
    asset = await repository.createAsset({ assetClass: 'equity', subClass, name, ticker, isin: stock.isin });

  const priced = chart
    ? await repository.upsertInstrument({
        assetId: asset.id,
        source: 'yahoo',
        type: 'stock',
        symbol: chart.symbol,
        venue: chart.exchange,
        quote: chart.currency,
        status: 'trading',
      })
    : null;

  const instrument = await repository.upsertInstrument({
    assetId: asset.id,
    source: stock.source,
    type: 'stock',
    symbol: stock.symbol,
    venue: chart?.exchange ?? null,
    quote: normalizeCurrency(stock.currency),
    status: 'trading',
    platformId: stock.platformId,
    priceInstrumentId: priced?.id ?? null,
    metadata: { isin: stock.isin, name: stock.name },
  });
  return { assetId: asset.id, instrumentId: instrument.id };
}
