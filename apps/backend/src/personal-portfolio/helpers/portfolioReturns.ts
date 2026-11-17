// As contas da rentabilidade do resumo. O dinheiro que a pessoa mete ou tira (depósitos e
// levantamentos) não é ganho nem perda; o resto (preços, juros, dividendos, comissões,
// impostos, câmbio) é.

/** Um ponto do gráfico: quando começa e acaba (ms), o valor no fim e o que entrou (+) ou saiu (−) nele. */
export type ReturnStep = { start: number; end: number; value: number; flow: number };

/** A rentabilidade em cada ponto, desde o início do período (em %, nula quando não se pode calcular). */
export type ReturnPoint = {
  // O valor de partida mais o que entrou menos o que saiu
  invested: number;
  // O valor menos isso, em dinheiro
  gain: number;
  // O ganho sobre o investido
  simplePct: number | null;
  // Ponderada no tempo (cada dia rende X %, encadeado; ignora quando entrou o dinheiro)
  twrPct: number | null;
  // Ponderada pelo dinheiro (Dietz modificado: conta quanto tempo cada entrada esteve lá)
  mwrPct: number | null;
};

// Abaixo disto (na moeda) uma base não serve para dividir: um saldo a zero, os cêntimos de um câmbio
const MIN_BASE = 1;
const YEAR_MS = 365.25 * 86_400_000;
const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * A rentabilidade de cada ponto. Com `fromZero` (desde sempre) parte-se de 0 e as entradas
 * do primeiro ponto contam; nos outros períodos o primeiro ponto é a base (o que já lá
 * estava) e fica a 0 %. Devolve também a TIR anual (XIRR) do período todo.
 */
export function computeReturns(steps: ReturnStep[], fromZero: boolean) {
  const points: ReturnPoint[] = [];
  if (!steps.length) return { points, xirrPct: null as number | null, days: 0 };

  const first = fromZero ? 0 : 1;
  const base = fromZero ? 0 : steps[0].value;
  const startAt = fromZero ? steps[0].start : steps[0].end;
  if (!fromZero) points.push({ invested: round(base), gain: 0, simplePct: 0, twrPct: 0, mwrPct: 0 });

  const flows: { at: number; amount: number }[] = [];
  let cumulativeFlow = 0;
  let growth = 1;
  for (let index = first; index < steps.length; index += 1) {
    const step = steps[index];
    const previous = index === 0 ? 0 : steps[index - 1].value;

    // Ponderada no tempo: o dinheiro entra no início do ponto e rende com o resto
    const start = previous + step.flow;
    if (start >= MIN_BASE) growth *= step.value / start;

    if (step.flow) flows.push({ at: step.start, amount: step.flow });
    cumulativeFlow += step.flow;
    const invested = base + cumulativeFlow;
    const gain = step.value - invested;

    // Dietz modificado até este ponto: cada entrada pesa o tempo que lá esteve
    const span = step.end - startAt;
    const weighted =
      base + flows.reduce((sum, flow) => sum + flow.amount * Math.min(1, Math.max(0, (step.end - flow.at) / span)), 0);

    points.push({
      invested: round(invested),
      gain: round(gain),
      simplePct: invested >= MIN_BASE ? round((gain / invested) * 100) : null,
      twrPct: round((growth - 1) * 100),
      mwrPct: span > 0 && weighted >= MIN_BASE ? round((gain / weighted) * 100) : null,
    });
  }

  const last = steps[steps.length - 1];
  const cashflows = [
    ...(base ? [{ at: startAt, amount: -base }] : []),
    ...flows.map((flow) => ({ at: flow.at, amount: -flow.amount })),
    { at: last.end, amount: last.value },
  ];
  const xirr = solveXirr(cashflows, startAt);
  return {
    points,
    xirrPct: xirr === null ? null : round(xirr * 100),
    days: Math.round((last.end - startAt) / 86_400_000),
  };
}

/**
 * A taxa anual que põe a zero o valor atual dos fluxos (do ponto de vista da carteira:
 * o que se mete é negativo, o valor final positivo). Por bisseção; nula se não houver
 * solução ou o período for de menos de um dia.
 */
function solveXirr(cashflows: { at: number; amount: number }[], startAt: number): number | null {
  const end = Math.max(...cashflows.map((flow) => flow.at));
  if (end - startAt < 86_400_000) return null;
  if (!cashflows.some((flow) => flow.amount < 0) || !cashflows.some((flow) => flow.amount > 0)) return null;
  const npv = (rate: number) =>
    cashflows.reduce((sum, flow) => sum + flow.amount / (1 + rate) ** ((flow.at - startAt) / YEAR_MS), 0);
  let low = -0.9999;
  let high = 100;
  let lowValue = npv(low);
  if (Math.sign(lowValue) === Math.sign(npv(high))) return null;
  for (let iteration = 0; iteration < 200; iteration += 1) {
    const middle = (low + high) / 2;
    const value = npv(middle);
    if (Math.abs(value) < 1e-7) return middle;
    if (Math.sign(value) === Math.sign(lowValue)) {
      low = middle;
      lowValue = value;
    } else high = middle;
  }
  return (low + high) / 2;
}
