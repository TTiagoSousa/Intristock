// O primeiro dia com velas em cada corretora: a Binance abriu em 2017 e a
// Coinbase (Exchange) em 2015. Antes disso não há velas em lado nenhum
const EARLIEST: Record<string, number> = {
  binance: Date.UTC(2017, 0, 1),
  coinbase: Date.UTC(2015, 0, 1),
};

/** O primeiro instante (ms UTC) com velas na corretora de um mercado. */
export function earliestCandle(source: string) {
  return EARLIEST[source] ?? EARLIEST.binance;
}
