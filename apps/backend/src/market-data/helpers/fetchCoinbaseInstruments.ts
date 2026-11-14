import axios from 'axios';
import { RemoteInstrument } from './syncInstruments';

const PRODUCTS = 'https://api.exchange.coinbase.com/products';

const TIMEOUT_MS = 60_000;

// Os pares em dólar, dólar estável e euro. BTC, GBP, … ficam de fora do catálogo
export const COINBASE_QUOTES = ['USD', 'USDC', 'USDT', 'EUR'];

interface CoinbaseProduct {
  id: string;
  base_currency: string;
  quote_currency: string;
  quote_increment: string;
  base_increment: string;
  min_market_funds: string;
  status: string;
  trading_disabled: boolean;
  cancel_only: boolean;
  limit_only: boolean;
  post_only: boolean;
}

// Só o spot: 'delisted' já saiu; parado, só cancelamentos ou só limite conta como suspenso
const productStatus = (
  product: CoinbaseProduct,
): RemoteInstrument['status'] => {
  if (product.status !== 'online') return 'delisted';
  if (product.trading_disabled || product.cancel_only || product.limit_only) {
    return 'halted';
  }
  return 'trading';
};

/**
 * Os mercados spot da Coinbase (Coinbase Exchange, API pública sem chave), no
 * formato do catálogo: cada par (BTC-USD) é um Instrument e a moeda base o
 * Asset (o mesmo BTC da Binance). O passo e os mínimos vão no `metadata` com
 * os nomes da Binance, para o formulário do simulador os propor igual.
 */
export async function fetchCoinbaseInstruments(): Promise<RemoteInstrument[]> {
  const { data } = await axios.get<CoinbaseProduct[]>(PRODUCTS, {
    timeout: TIMEOUT_MS,
    headers: { 'User-Agent': 'IntriStock' },
  });

  return data
    .filter((product) => COINBASE_QUOTES.includes(product.quote_currency))
    .map(
      (product): RemoteInstrument => ({
        ticker: product.base_currency,
        assetClass: 'alternative',
        subClass: 'crypto',
        type: 'spot',
        symbol: product.id,
        quote: product.quote_currency,
        status: productStatus(product),
        expiresAt: null,
        metadata: {
          tickSize: product.quote_increment,
          stepSize: product.base_increment,
          // A Coinbase não tem quantidade mínima, só o valor mínimo de cada ordem
          minQty: product.base_increment,
          minNotional: product.min_market_funds,
        },
      }),
    );
}
