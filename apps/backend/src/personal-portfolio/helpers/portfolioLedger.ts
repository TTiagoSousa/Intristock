// As regras de um portefólio: o que cada tipo de transação faz ao dinheiro e às posições.

/**
 * O que cada tipo faz ao dinheiro (na moeda da transação). O valor vem positivo, menos
 * nos acertos da corretora que vão ao contrário do tipo (uma comissão devolvida, um
 * dividendo estornado): ficam com o tipo e o valor negativo, para continuarem a ser
 * ganho ou custo e não dinheiro que a pessoa meteu ou tirou.
 */
export const CASH_SIGN: Record<string, number> = {
  deposit: 1,
  interest: 1,
  dividend: 1,
  transfer_in: 1,
  withdrawal: -1,
  fee: -1,
  tax: -1,
  transfer_out: -1,
};

/**
 * O que cada tipo faz à quantidade de um ativo (não ao dinheiro: o dinheiro de uma compra
 * sai noutra linha, `transfer_out`, no portefólio do dinheiro). O `adjust` já vem com sinal.
 */
export const POSITION_SIGN: Record<string, number> = { buy: 1, sell: -1, adjust: 1, valuation: 0 };

/**
 * Um bem comprado, oferecido ou vendido sem dinheiro ligado a um portefólio (`externalType`
 * `in_kind`): o valor entra (ou sai) de fora, como um depósito (ou levantamento) — para a
 * rentabilidade não o contar como ganho (ou perda).
 */
export const IN_KIND = 'in_kind';
export const inKindFlow = (kind: string, externalType: string | null | undefined, amount: number) =>
  externalType === IN_KIND ? (kind === 'buy' ? amount : kind === 'sell' ? -amount : 0) : 0;

/**
 * A moeda em que um preço conta: os pence ingleses (GBX) são centésimos da libra, e
 * convertem-se como libras ÷ 100.
 */
export const priceCurrency = (quote: string) =>
  quote === 'GBX'
    ? { code: 'GBP', factor: 0.01 }
    : STABLE_USD.includes(quote)
      ? { code: 'USD', factor: 1 }
      : { code: quote, factor: 1 };

// As stablecoins do dólar valem um dólar (os pares BTCUSDT da Binance contam em USD)
const STABLE_USD = ['USDT', 'USDC', 'FDUSD', 'BUSD', 'DAI', 'TUSD', 'USDP'];

// Os mercados que dão o preço eles próprios (os das corretoras de ações apontam para um destes)
export const PRICED_SOURCES = ['yahoo', 'binance', 'coinbase'];

/** Um mercado de onde vem o preço. */
export type PriceMarket = { id: string; symbol: string; quote: string; source: string; type: string };

/**
 * O mercado de onde vem o preço de uma transação: o que o mercado dela indica (uma ação
 * da Trading 212 → o do Yahoo) ou ele próprio, se der preço (uma compra na Binance, uma
 * ação escolhida no Yahoo). Sem nenhum, nulo.
 */
export const priceMarketOf = (
  instrument: (PriceMarket & { priceInstrument: PriceMarket | null }) | null | undefined,
): PriceMarket | null => {
  if (!instrument) return null;
  if (instrument.priceInstrument) return instrument.priceInstrument;
  if (!PRICED_SOURCES.includes(instrument.source)) return null;
  const { id, symbol, quote, source, type } = instrument;
  return { id, symbol, quote, source, type };
};

/**
 * A ordem em que as transações se aplicam: pelo instante (o da corretora; nas manuais, o
 * dia), no mesmo instante as avaliações por último (a de um bem registado com o valor de
 * hoje não pode vir antes da entrada) e depois pela ordem em que se gravaram.
 */
export const compareLedger = (
  a: { date: Date; externalAt?: Date | null; kind: string; createdAt?: Date },
  b: { date: Date; externalAt?: Date | null; kind: string; createdAt?: Date },
) =>
  (a.externalAt ?? a.date).getTime() - (b.externalAt ?? b.date).getTime() ||
  Number(a.kind === 'valuation') - Number(b.kind === 'valuation') ||
  (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);

/** Uma posição a correr: a quantidade e o custo médio (o método do custo médio ponderado). */
export type Position = {
  quantity: number;
  // O que custou o que ainda se tem, na moeda das compras
  cost: number;
  // O que se ganhou ou perdeu no que já se vendeu
  realized: number;
  // O último preço por unidade das compras e vendas (sem fecho do mercado, vale por este)
  lastUnitPrice: number;
};

export const emptyPosition = (): Position => ({ quantity: 0, cost: 0, realized: 0, lastUnitPrice: 0 });

/** Aplica uma transação de ações a uma posição. */
export function applyToPosition(position: Position, kind: string, quantity: number, amount: number) {
  if (kind === 'buy') {
    position.quantity += quantity;
    position.cost += amount;
    if (quantity) position.lastUnitPrice = amount / quantity;
  } else if (kind === 'sell') {
    // Sai a parte do custo médio que corresponde ao vendido
    const share = position.quantity > 0 ? Math.min(1, quantity / position.quantity) : 0;
    const removed = position.cost * share;
    position.realized += amount - removed;
    position.cost -= removed;
    position.quantity -= quantity;
    if (quantity) position.lastUnitPrice = amount / quantity;
  } else if (kind === 'adjust') {
    // Um split muda a quantidade e não o custo
    position.quantity += quantity;
  } else if (kind === 'valuation') {
    // Um bem avaliado: o valor (o `amount`) é o de tudo o que se tem dele
    if (position.quantity) position.lastUnitPrice = amount / position.quantity;
  }
  if (Math.abs(position.quantity) < 1e-9) {
    position.quantity = 0;
    position.cost = 0;
  }
}
