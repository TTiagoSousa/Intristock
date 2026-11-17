// As regras de um portefólio: o que cada tipo de transação faz ao dinheiro e às posições.

/** O que cada tipo faz ao dinheiro (na moeda da transação). */
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
export const POSITION_SIGN: Record<string, number> = { buy: 1, sell: -1, adjust: 1 };

/**
 * A moeda em que um preço conta: os pence ingleses (GBX) são centésimos da libra, e
 * convertem-se como libras ÷ 100.
 */
export const priceCurrency = (quote: string) =>
  quote === 'GBX' ? { code: 'GBP', factor: 0.01 } : { code: quote, factor: 1 };

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
  }
  if (Math.abs(position.quantity) < 1e-9) {
    position.quantity = 0;
    position.cost = 0;
  }
}
