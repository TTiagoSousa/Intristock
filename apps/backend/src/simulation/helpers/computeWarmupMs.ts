import {
  ConditionDto,
  EntryRuleDto,
  ExitPriceDto,
  Indicator_Kind,
  OperandDto,
  Timeframe,
  isGroup,
  isIndicator,
  isSeries,
  isWindow,
} from '../dto/create-simulation.dto';
import { TIMEFRAME_MS } from './timeframeMs';

// Velas de que um indicador precisa para estar pronto: a média simples, as do
// período (a vela atual e as N − 1 antes). A exponencial e o RSI dependem de
// tudo o que veio antes, por isso leva-se o bastante para o começo já não pesar
// (5 e 10 períodos: sobra menos de 0,01%; o RSI aquece como na trading-chart)
export const indicatorBars = (kind: Indicator_Kind, period: number) => {
  if (kind === 'ema') return period * 5;
  if (kind === 'rsi') return period * 10;
  return period - 1;
};

// A média do RSI precisa das velas dela depois de o RSI estar pronto
const smoothingBars = (operand: OperandDto | ExitPriceDto) =>
  'smoothing' in operand && operand.smoothing
    ? indicatorBars(operand.smoothing.kind, operand.smoothing.period)
    : 0;

// Quantas velas antes da atual um valor precisa: a vela -3 precisa de 2; uma
// média de 21 na -2 precisa de 1 + 20. A abertura (mercado) e um número, nada
const lookback = (operand: OperandDto | ExitPriceDto) => {
  if (!isSeries(operand.kind)) return 0;
  const back = -(operand.offset ?? -1) - 1;
  if (isWindow(operand.kind)) return back + (operand.period ?? 1) - 1;
  return isIndicator(operand.kind)
    ? back +
        indicatorBars(operand.kind, operand.period ?? 1) +
        smoothingBars(operand)
    : back;
};

// Os níveis do dia e da semana precisam do dia (ou da semana) anterior inteiro
const DAY_MS = 24 * 60 * 60 * 1000;
const sessionMs = (operand: OperandDto | ExitPriceDto) => {
  if (operand.kind !== 'session') return 0;
  return operand.level?.includes('week') ? 15 * DAY_MS : 2 * DAY_MS;
};

// O perfil de volume: a sessão em curso começou no máximo um dia antes (as
// noturnas passam a meia-noite); N sessões para trás, até N + 2 dias; o nível
// virgem pode vir de longe, até PROFILE_NAKED_DAYS
export const PROFILE_NAKED_DAYS = 30;
const profileMs = (operand: OperandDto | ExitPriceDto, main: number) => {
  if (operand.kind !== 'profile') return 0;
  const days =
    operand.profile === 'developing'
      ? 2
      : operand.profile === 'naked'
        ? PROFILE_NAKED_DAYS
        : (operand.sessionsBack ?? 1) + 2;
  return days * DAY_MS + (-(operand.offset ?? -1) - 1) * main;
};

/**
 * Quanto tempo descarregar antes do início para os indicadores já estarem
 * prontos na primeira vela simulada: os das condições de entrada e de saída e
 * os dos preços de entrada e de saída, cada um no seu tempo gráfico. Um valor
 * de outro tempo gráfico precisa de mais uma vela dele (a que está a decorrer
 * no início pode ter começado antes); um cruzamento compara também a vela
 * anterior da simulação, e uma condição "nas últimas N velas" as N − 1 antes.
 * O stop na mínima/máxima de N velas precisa delas; num nível, do valor dele. O
 * mesmo para os ajustes do stop, os reforços e a preparação (que pode ter-se armado
 * `bars` velas antes). Os níveis do dia e da semana precisam do anterior inteiro;
 * o perfil de volume, das sessões de que é feito.
 */
export function computeWarmupMs(entries: EntryRuleDto[], timeframe: Timeframe) {
  const main = TIMEFRAME_MS[timeframe];

  const need = (operand: OperandDto | ExitPriceDto, cross = 0) => {
    if (operand.kind === 'session') return sessionMs(operand) + cross * main;
    if (operand.kind === 'profile') {
      return profileMs(operand, main) + cross * main;
    }
    if (!isSeries(operand.kind)) return 0;
    const own = operand.timeframe ?? timeframe;
    const extra = own === timeframe ? 0 : 1;
    return (lookback(operand) + extra) * TIMEFRAME_MS[own] + cross * main;
  };

  // Um grupo conta pelas condições dele, com as velas do grupo somadas
  const conditionNeed = (condition: ConditionDto, before = 0): number => {
    const within = condition.within ? condition.within.bars - 1 : 0;
    if (isGroup(condition)) {
      return Math.max(
        0,
        ...(condition.conditions ?? []).map((inner) =>
          conditionNeed(inner, before + within),
        ),
      );
    }
    const cross = condition.operator.startsWith('cross_') ? 1 : 0;
    return (
      Math.max(
        need(condition.left, cross),
        need(condition.right, cross),
        condition.operator === 'between' && condition.rightTo
          ? need(condition.rightTo)
          : 0,
      ) +
      (before + within) * main
    );
  };

  let warmup = 0;
  for (const entry of entries) {
    const exits = entry.exits ?? [];
    const rules = entry.stopRules ?? [];
    const conditions = [
      ...entry.conditions,
      ...exits.flatMap((exit) => exit.conditions),
      ...rules.flatMap((rule) => rule.conditions ?? []),
      ...(entry.scaleIns ?? []).flatMap((add) => add.conditions ?? []),
      ...(entry.setup?.cancel ?? []),
    ];

    for (const condition of conditions) {
      warmup = Math.max(warmup, conditionNeed(condition));
    }
    // A preparação pode ter-se armado até `bars` velas antes
    for (const condition of entry.setup?.conditions ?? []) {
      warmup = Math.max(
        warmup,
        conditionNeed(condition, entry.setup?.bars ?? 0),
      );
    }
    for (const rule of rules) {
      if (rule.to === 'swing' && rule.bars) {
        warmup = Math.max(warmup, (rule.bars + 1) * main);
      }
      if (rule.to === 'level' && rule.level) {
        warmup = Math.max(warmup, need(rule.level));
      }
    }
    if (entry.price) warmup = Math.max(warmup, need(entry.price));
    for (const exit of exits) warmup = Math.max(warmup, need(exit.price));
    if (entry.stopLossMode === 'swing' && entry.stopLossBars) {
      warmup = Math.max(warmup, entry.stopLossBars * main);
    }
    if (entry.stopLossMode === 'level' && entry.stopLossLevel) {
      warmup = Math.max(warmup, need(entry.stopLossLevel));
    }
  }
  return warmup + main;
}
