import { isGroupPayload } from '../../../../Hooks/Trading/useSimulation';
import type {
  Comparison_Payload,
  Condition_Payload,
  Entry_Payload,
  Exit_Payload,
  Exit_Price_Payload,
  Indicator_Payload,
  Simulation_Run,
} from '../../../../Hooks/Trading/useSimulation';
import { optionsFromStrategy, scheduleForm } from './strategyOptions';
import {
  isWindowKind,
  type Value_Form,
  isIndicatorKind,
  type Indicator_Form,
  shiftOf,
  type Condition_Form,
  type Simulation_Form_State,
} from './formState';
import {
  newId,
  value,
  newIndicator,
  newCondition,
  newPartial,
  newStopRule,
  newScaleIn,
  newContext,
} from './formDefaults';

// --- de uma simulação gravada para o formulário -----------------------------

const optionalText = (number: number | null | undefined) => (number == null ? '' : String(number));

// As opções de um perfil de volume gravado (num indicador ou num uso)
const profileForm = (payload: Indicator_Payload | Exit_Price_Payload) => ({
  session: payload.session ?? 'each',
  customSession: payload.customSession ?? '0930-1600',
  exchange: payload.exchange ?? '',
  rowsLayout: payload.rowsLayout ?? 'rows',
  rowSize: String(payload.rowSize ?? 24),
  vaPct: String(payload.vaPct ?? 70),
});

const sizingOf = (sizing: Entry_Payload['sizing']) => ({
  sizingMode: sizing?.mode ?? 'all',
  sizingValue: sizing?.value != null ? String(sizing.value) : '',
});

/**
 * As entradas de uma simulação gravada. A versão 3 já as tem com as saídas;
 * a 2 tinha stop e take profit gerais e condições de saída para todas (ao
 * mercado); a 1 uma só entrada com a direção e as condições soltas.
 */
export const entriesOf = (strategy: Simulation_Run['strategy']): Entry_Payload[] => {
  if ((strategy.version ?? 1) >= 3 && strategy.entries) return strategy.entries;

  const legacy = strategy.entries ?? [
    { side: strategy.side ?? 'long', conditions: strategy.conditions ?? [], stopLossPct: null, takeProfitPct: null },
  ];
  const exits = (strategy.exitConditions ?? []).map(
    (condition): Exit_Payload => ({ conditions: [condition], price: { kind: 'market' } }),
  );
  return legacy.map((entry) => ({
    side: entry.side,
    conditions: entry.conditions,
    stopLossPct: entry.stopLossPct ?? strategy.stopLossPct ?? null,
    takeProfitPct: entry.takeProfitPct ?? strategy.takeProfitPct ?? null,
    exits,
  }));
};

/**
 * Lê os valores gravados de volta. As médias com indicador voltam a ele; as
 * soltas (simulações anteriores aos indicadores) passam a um indicador criado
 * agora, um por cada média diferente.
 */
const valueReader = (indicators: Indicator_Form[]) => (payload: Exit_Price_Payload): Value_Form => {
  if (payload.kind === 'market') return value({ kind: 'market' });
  if (payload.kind === 'number') return value({ kind: 'number', value: String(payload.value ?? 0) });
  if (payload.kind === 'session') {
    return value({
      kind: 'session',
      level: payload.level ?? 'day_high',
      rangeStart: payload.rangeStart ?? '09:00',
      rangeMinutes: String(payload.rangeMinutes ?? 60),
    });
  }

  if (payload.kind === 'profile') {
    let indicator = indicators.find((item) => item.id === payload.indicator);
    if (!indicator) {
      indicator = newIndicator({ kind: 'svp', ...profileForm(payload) });
      indicators.push(indicator);
    }
    return value({
      kind: 'indicator',
      indicatorId: indicator.id,
      back: Math.max(0, -(payload.offset ?? -1) - 1),
      profileLevel: payload.profileLevel ?? 'poc',
      profileSource: payload.profile ?? 'session',
      sessionsBack: String(payload.sessionsBack ?? 1),
    });
  }

  const offset = payload.offset ?? -2;
  let back = Math.max(0, -offset - 2);
  if (isWindowKind(payload.kind)) {
    return value({
      kind: 'window',
      windowKind: payload.kind,
      period: String(payload.period ?? 20),
      source: payload.field && payload.field !== 'volume' ? payload.field : 'high',
      back,
      timeframe: payload.timeframe ?? '',
    });
  }
  if (isIndicatorKind(payload.kind)) {
    const kind = payload.kind;
    const period = String(payload.period ?? 21);
    const field = payload.field ?? 'close';
    const timeframe = payload.timeframe ?? '';
    let indicator =
      indicators.find((item) => item.id === payload.indicator) ??
      indicators.find(
        (item) => item.kind === kind && item.period === period && item.field === field && item.timeframe === timeframe,
      );
    if (!indicator) {
      indicator = newIndicator({ kind, period, field, timeframe });
      indicators.push(indicator);
    }
    // O offset traz o deslocamento do indicador; a vela escolhida é o resto
    back = Math.max(0, back - shiftOf(indicator));
    return value({
      kind: 'indicator',
      indicatorId: indicator.id,
      back,
      line: payload.smoothing ? 'average' : 'value',
    });
  }

  const timeframe = payload.timeframe ?? '';
  if (offset === -1) return value({ kind: 'candle', source: 'open_current', timeframe });
  return value({ kind: 'candle', source: payload.field ?? 'close', back, timeframe });
};

/** O formulário de uma simulação gravada, para a repetir ou mudar. */
export const fromRun = (run: Simulation_Run): Simulation_Form_State => {
  const indicators: Indicator_Form[] = (run.strategy.indicators ?? []).map((indicator) => ({
    id: indicator.id,
    name: indicator.name ?? '',
    kind: indicator.kind,
    period: String(indicator.period ?? 21),
    field: indicator.field ?? 'close',
    timeframe: indicator.timeframe ?? '',
    shift: String(indicator.shift ?? 0),
    smoothing: indicator.smoothing?.kind ?? '',
    smoothingPeriod: String(indicator.smoothing?.period ?? 14),
    ...profileForm(indicator),
    volume: indicator.volume ?? 'updown',
  }));
  const read = valueReader(indicators);
  const withinForm = (condition: Condition_Payload) => ({
    withinMode: condition.within?.mode ?? ('' as const),
    withinBars: String(condition.within?.bars ?? 3),
  });
  const comparisonForm = (condition: Comparison_Payload): Condition_Form => ({
    id: newId(),
    left: read(condition.left),
    operator: condition.operator,
    right: read(condition.right),
    rightTo: condition.rightTo ? read(condition.rightTo) : value({ kind: 'number', value: '70' }),
    rightPct: optionalText(condition.rightPct),
    ...withinForm(condition),
    group: null,
    groupMatch: 'all',
  });
  const conditionForm = (condition: Condition_Payload): Condition_Form =>
    isGroupPayload(condition)
      ? {
          ...newCondition(indicators),
          ...withinForm(condition),
          group: condition.conditions.map(comparisonForm),
          groupMatch: condition.match ?? 'all',
        }
      : comparisonForm(condition);

  const profitForm = (rule: { r?: number | null; pct?: number | null }) => ({
    profitMode: rule.pct && !rule.r ? ('pct' as const) : ('r' as const),
    profitValue: String(rule.r ?? rule.pct ?? 1),
  });
  const entries = entriesOf(run.strategy).map((entry) => ({
    id: newId(),
    name: entry.name ?? '',
    side: entry.side,
    conditions: entry.conditions.map(conditionForm),
    match: entry.match ?? 'all',
    setup: entry.setup
      ? {
          conditions: entry.setup.conditions.map(conditionForm),
          match: entry.setup.match ?? 'all',
          bars: String(entry.setup.bars),
          cancel: (entry.setup.cancel ?? []).map(conditionForm),
          cancelMatch: entry.setup.cancelMatch ?? 'all',
        }
      : null,
    context: (entry.context ?? []).map((rule) => ({
      ...newContext(),
      kind: rule.kind,
      scope: rule.scope ?? 'all',
      operator: rule.operator ?? 'lt',
      value: String(rule.value ?? 0),
      result: rule.result ?? 'loss',
    })),
    stopRules: (entry.stopRules ?? []).map((rule) => ({
      ...newStopRule(indicators),
      trigger: rule.trigger,
      ...profitForm(rule),
      conditions: rule.conditions?.length ? rule.conditions.map(conditionForm) : [newCondition(indicators)],
      match: rule.match ?? 'all',
      to: rule.to,
      bars: String(rule.bars ?? 3),
      level: rule.level ? read(rule.level) : value({ kind: 'candle', source: 'low' }),
      trailPct: String(rule.trailPct ?? 1),
      bufferPct: optionalText(rule.bufferPct),
    })),
    scaleIns: (entry.scaleIns ?? []).map((add) => ({
      ...newScaleIn(indicators),
      name: add.name ?? '',
      trigger: add.trigger,
      ...profitForm(add),
      conditions: add.conditions?.length ? add.conditions.map(conditionForm) : [newCondition(indicators)],
      match: add.match ?? 'all',
      sizePct: String(add.sizePct),
      moveStop: add.moveStop ?? false,
    })),
    price: read(entry.price ?? { kind: 'market' }),
    stopMode: entry.stopLossMode ?? 'pct',
    stopLossPct: optionalText(entry.stopLossPct),
    stopBars: String(entry.stopLossBars ?? 10),
    stopLevel: entry.stopLossLevel ? read(entry.stopLossLevel) : value({ kind: 'candle', source: 'low' }),
    stopBufferPct: optionalText(entry.stopLossBufferPct),
    stopLossName: entry.stopLossName ?? '',
    takeMode: entry.takeProfitR ? ('r' as const) : ('pct' as const),
    takeProfitPct: optionalText(entry.takeProfitPct),
    takeR: String(entry.takeProfitR ?? 2),
    takeProfitName: entry.takeProfitName ?? '',
    partials: (entry.partialExits ?? []).map((part) =>
      newPartial({
        name: part.name ?? '',
        closePct: String(part.closePct),
        mode: part.r ? 'r' : 'pct',
        value: String(part.r ?? part.pct ?? 1),
        moveStop: part.moveStop ?? false,
      }),
    ),
    exits: (entry.exits ?? []).map((exit) => ({
      id: newId(),
      name: exit.name ?? '',
      conditions: exit.conditions.map(conditionForm),
      match: exit.match ?? 'all',
      price: read(exit.price),
      schedule: scheduleForm(exit.schedule),
    })),
    orderBars: String(entry.orderBars ?? 1),
    orderTrack: entry.orderTrack ?? false,
    orderCancel: entry.orderCancel ?? false,
    maxPositions: String(entry.maxPositions ?? 1),
    // Simulações de antes do tamanho por entrada: o geral
    ...sizingOf(entry.sizing ?? run.strategy.sizing),
    leverage: String(entry.leverage ?? run.strategy.leverage ?? 1),
    schedule: scheduleForm(entry.schedule),
    stopSchedule: scheduleForm(entry.stopLossSchedule),
    takeSchedule: scheduleForm(entry.takeProfitSchedule),
    trailingPct: optionalText(entry.trailingStopPct),
    breakEvenPct: optionalText(entry.breakEvenPct),
    maxBars: optionalText(entry.maxBars),
  }));

  return {
    instrument: {
      id: run.instrument.id,
      source: run.instrument.source,
      type: run.instrument.type,
      symbol: run.instrument.symbol,
      quote: run.instrument.quote,
      status: 'trading',
      expiresAt: null,
      metadata: run.instrument.metadata ?? null,
      asset: { ticker: run.instrument.asset.ticker, name: run.instrument.asset.ticker ?? run.instrument.symbol },
    },
    timeframe: run.timeframe,
    from: run.fromDate.slice(0, 10),
    // O fim gravado é exclusivo (meia-noite seguinte); o formulário quer o último dia
    to: new Date(new Date(run.toDate).getTime() - 1).toISOString().slice(0, 10),
    initialCapital: String(run.strategy.initialCapital),
    // Em 'exit' a % que se mostra é a de saída; nas outras, a de entrada
    feePct: String(
      run.strategy.feeMode === 'exit'
        ? (run.strategy.feeExitPct ?? run.strategy.feePct)
        : (run.strategy.feeEntryPct ?? run.strategy.feePct),
    ),
    feeMode: run.strategy.feeMode ?? 'both',
    feeExitPct: String(run.strategy.feeExitPct ?? run.strategy.feePct),
    compounding: run.strategy.compounding ?? true,
    options: optionsFromStrategy(run.strategy),
    indicators,
    entries,
  };
};
