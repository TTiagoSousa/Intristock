import axios from 'axios';
import { RemoteInstrument } from './syncInstruments';

const SPOT_EXCHANGE_INFO = 'https://api.binance.com/api/v3/exchangeInfo';
const FUTURES_EXCHANGE_INFO = 'https://fapi.binance.com/fapi/v1/exchangeInfo';

// A lista do spot passa dos 15 MB: dá tempo para chegar
const TIMEOUT_MS = 60_000;

// Só os pares em dólar estável. TRY, EUR, BTC… ficam de fora do catálogo
export const BINANCE_QUOTES = ['USDT', 'USDC'];

interface BinanceFilter {
  filterType: string;
  tickSize?: string;
  stepSize?: string;
  minQty?: string;
  minNotional?: string;
  notional?: string;
}

interface SpotSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  filters: BinanceFilter[];
}

interface FuturesSymbol extends SpotSymbol {
  contractType: string;
  deliveryDate: number;
  onboardDate: number;
  underlyingType: string;
  underlyingSubType?: string[];
}

const filterValue = (
  filters: BinanceFilter[],
  type: string,
  key: 'tickSize' | 'stepSize' | 'minQty' | 'minNotional' | 'notional',
) => filters.find((filter) => filter.filterType === type)?.[key];

// BREAK no spot é um par parado, e quase sempre um que já saiu da bolsa
const spotStatus = (status: string): RemoteInstrument['status'] =>
  status === 'TRADING' ? 'trading' : 'delisted';

// SETTLING é um contrato a ser retirado; CLOSE já saiu
const futuresStatus = (status: string): RemoteInstrument['status'] => {
  if (status === 'TRADING') return 'trading';
  if (status === 'CLOSE') return 'delisted';
  return 'halted';
};

// Os futuros da Binance não são só cripto: há ações (TSLA, Hong Kong, Coreia),
// matérias-primas e índices
const futuresClass = (underlyingType: string) => {
  switch (underlyingType) {
    case 'COIN':
      return { assetClass: 'alternative', subClass: 'crypto' };
    case 'INDEX':
      return { assetClass: 'alternative', subClass: 'index' };
    case 'EQUITY':
    case 'HK_EQUITY':
    case 'KR_EQUITY':
    case 'PREMARKET':
      return { assetClass: 'equity', subClass: 'stock' };
    case 'COMMODITY':
      return { assetClass: 'commodity', subClass: 'commodity' };
    default:
      return { assetClass: 'alternative', subClass: 'other' };
  }
};

export async function fetchBinanceInstruments(): Promise<RemoteInstrument[]> {
  const [spot, futures] = await Promise.all([
    axios.get<{ symbols: SpotSymbol[] }>(SPOT_EXCHANGE_INFO, {
      timeout: TIMEOUT_MS,
    }),
    axios.get<{ symbols: FuturesSymbol[] }>(FUTURES_EXCHANGE_INFO, {
      timeout: TIMEOUT_MS,
    }),
  ]);

  const spotInstruments = spot.data.symbols.map(
    (item): RemoteInstrument => ({
      ticker: item.baseAsset,
      assetClass: 'alternative',
      subClass: 'crypto',
      type: 'spot',
      symbol: item.symbol,
      quote: item.quoteAsset,
      status: spotStatus(item.status),
      expiresAt: null,
      metadata: {
        tickSize: filterValue(item.filters, 'PRICE_FILTER', 'tickSize'),
        stepSize: filterValue(item.filters, 'LOT_SIZE', 'stepSize'),
        // O mínimo de cada ordem: em quantidade e em valor (o simulador usa-os)
        minQty: filterValue(item.filters, 'LOT_SIZE', 'minQty'),
        minNotional:
          filterValue(item.filters, 'NOTIONAL', 'minNotional') ??
          filterValue(item.filters, 'MIN_NOTIONAL', 'minNotional'),
      },
    }),
  );

  const futuresInstruments = futures.data.symbols.map(
    (item): RemoteInstrument => {
      const perpetual = item.contractType.includes('PERPETUAL');
      return {
        ticker: item.baseAsset,
        ...futuresClass(item.underlyingType),
        type: perpetual ? 'perpetual' : 'future',
        symbol: item.symbol,
        quote: item.quoteAsset,
        status: futuresStatus(item.status),
        expiresAt: perpetual ? null : new Date(item.deliveryDate),
        metadata: {
          tickSize: filterValue(item.filters, 'PRICE_FILTER', 'tickSize'),
          stepSize: filterValue(item.filters, 'LOT_SIZE', 'stepSize'),
          minQty: filterValue(item.filters, 'LOT_SIZE', 'minQty'),
          minNotional: filterValue(item.filters, 'MIN_NOTIONAL', 'notional'),
          contractType: item.contractType,
          // O downloader não pede meses anteriores à listagem
          listedAt: new Date(item.onboardDate).toISOString(),
          categories: item.underlyingSubType ?? [],
        },
      };
    },
  );

  return [...spotInstruments, ...futuresInstruments].filter((item) =>
    BINANCE_QUOTES.includes(item.quote),
  );
}
