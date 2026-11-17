import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { StockPriceService } from 'src/market-data/stock-price.service';
import { MarketPriceQueryDto, MarketSearchQueryDto } from '../dto/personal-portfolio.dto';

/**
 * Os mercados para uma compra à mão, numa forma só: as ações e os ETF que o Yahoo
 * encontra (pelo símbolo do Yahoo, criados ao gravar) ou os pares à vista de uma
 * corretora de cripto que já estão na base (pelo id).
 */
export async function searchMarkets(query: MarketSearchQueryDto, stocks: StockPriceService) {
  const text = query.q.trim();
  if (query.kind === 'crypto') {
    const rows = await stocks.searchCrypto(query.source!, text);
    return rows.map((row) => ({
      instrumentId: row.id,
      yahooSymbol: null,
      symbol: row.symbol,
      name: row.asset.name,
      ticker: row.asset.ticker,
      quote: row.quote,
      venue: row.platform?.name ?? row.source,
      logo: row.platform?.logo ?? null,
      etf: false,
    }));
  }
  const quotes = await stocks.searchStocks(text).catch(() => {
    throw new ServiceUnavailableException('O Yahoo não respondeu');
  });
  return quotes.map((quote) => ({
    instrumentId: null,
    yahooSymbol: quote.symbol,
    symbol: quote.symbol,
    name: quote.name,
    ticker: quote.symbol.split('.')[0],
    quote: null,
    venue: quote.exchange,
    logo: null,
    etf: quote.quoteType === 'ETF',
  }));
}

/** O fecho de um mercado num dia (o último até esse dia), para propor o preço no formulário. */
export async function findMarketPrice(query: MarketPriceQueryDto, stocks: StockPriceService) {
  const day = query.date.slice(0, 10);
  if (query.yahooSymbol)
    return stocks.priceOn({ source: 'yahoo', type: 'stock', symbol: query.yahooSymbol.trim().toUpperCase() }, day);
  const market = await stocks.findMarket(query.instrumentId!);
  if (!market) throw new NotFoundException('Mercado não encontrado');
  return stocks.priceOn(market, day);
}
