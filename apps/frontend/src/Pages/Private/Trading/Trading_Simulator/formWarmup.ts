import { isGroupPayload } from '../../../../Hooks/Trading/useSimulation';
import type {
  Condition_Payload,
  Exit_Price_Payload,
  Timeframe,
} from '../../../../Hooks/Trading/useSimulation';
import {
  isWindowKind,
  isIndicatorKind,
  indicatorBars,
  type Simulation_Form_State,
  DAY_MS,
} from './formState';
import { entryPayload } from './formPayload';

// --- aquecimento --------------------------------------------------------------

const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
};

/**
 * Desde quando a simulação precisa de velas: o início menos o aquecimento dos
 * indicadores (o mesmo cálculo que o backend faz em computeWarmupMs).
 */
export const dataStart = (form: Simulation_Form_State) => {
  const main = TIMEFRAME_MS[form.timeframe];
  const need = (operand: Exit_Price_Payload, cross = 0) => {
    // Os níveis do dia e da semana precisam do anterior inteiro
    if (operand.kind === 'session') return (operand.level?.includes('week') ? 15 : 2) * DAY_MS + cross * main;
    // O perfil de volume: a sessão em curso, N acabadas para trás ou o virgem (até PROFILE_NAKED_DAYS)
    if (operand.kind === 'profile') {
      const days =
        operand.profile === 'developing' ? 2 : operand.profile === 'naked' ? PROFILE_NAKED_DAYS : (operand.sessionsBack ?? 1) + 2;
      return days * DAY_MS + (-(operand.offset ?? -1) - 1) * main + cross * main;
    }
    if (operand.kind !== 'price' && !isIndicatorKind(operand.kind) && !isWindowKind(operand.kind)) return 0;
    const back = -(operand.offset ?? -1) - 1;
    const average = operand.smoothing ? indicatorBars(operand.smoothing.kind, operand.smoothing.period) : 0;
    const lookback = isWindowKind(operand.kind)
      ? back + (operand.period ?? 1) - 1
      : isIndicatorKind(operand.kind)
        ? back + indicatorBars(operand.kind, operand.period ?? 1) + average
        : back;
    const own = operand.timeframe ?? form.timeframe;
    return (lookback + (own === form.timeframe ? 0 : 1)) * TIMEFRAME_MS[own] + cross * main;
  };

  // Um grupo conta pelas condições dele; "nas últimas N velas" soma N − 1 velas
  const conditionNeed = (condition: Condition_Payload, before = 0): number => {
    const within = condition.within ? condition.within.bars - 1 : 0;
    if (isGroupPayload(condition)) {
      return Math.max(0, ...condition.conditions.map((inner) => conditionNeed(inner, before + within)));
    }
    const cross = condition.operator.startsWith('cross_') ? 1 : 0;
    return (
      Math.max(need(condition.left, cross), need(condition.right, cross), condition.rightTo ? need(condition.rightTo) : 0) +
      (before + within) * main
    );
  };

  let warmup = 0;
  for (const entry of form.entries) {
    const payload = entryPayload(entry, false, form.indicators);
    const rules = payload.stopRules ?? [];
    const conditions = [
      ...payload.conditions,
      ...(payload.exits ?? []).flatMap((exit) => exit.conditions),
      ...rules.flatMap((rule) => rule.conditions ?? []),
      ...(payload.scaleIns ?? []).flatMap((add) => add.conditions ?? []),
      ...(payload.setup?.cancel ?? []),
    ];
    for (const condition of conditions) warmup = Math.max(warmup, conditionNeed(condition));
    // A preparação pode ter-se armado até `bars` velas antes
    for (const condition of payload.setup?.conditions ?? []) {
      warmup = Math.max(warmup, conditionNeed(condition, payload.setup?.bars ?? 0));
    }
    for (const rule of rules) {
      if (rule.to === 'swing' && rule.bars) warmup = Math.max(warmup, (rule.bars + 1) * main);
      if (rule.to === 'level' && rule.level) warmup = Math.max(warmup, need(rule.level));
    }
    if (payload.price) warmup = Math.max(warmup, need(payload.price));
    for (const exit of payload.exits ?? []) warmup = Math.max(warmup, need(exit.price));
    if (payload.stopLossMode === 'swing' && payload.stopLossBars) warmup = Math.max(warmup, payload.stopLossBars * main);
    if (payload.stopLossLevel) warmup = Math.max(warmup, need(payload.stopLossLevel));
  }
  const start = new Date(`${form.from}T00:00:00.000Z`).getTime();
  return Number.isNaN(start) ? null : new Date(start - warmup - main);
};

// O nível virgem pode vir de longe: o aquecimento leva estes dias (o mesmo que o backend)
export const PROFILE_NAKED_DAYS = 30;
