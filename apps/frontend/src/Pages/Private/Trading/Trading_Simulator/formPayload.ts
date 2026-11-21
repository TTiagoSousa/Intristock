import type {
  Comparison_Payload,
  Condition_Payload,
  Entry_Payload,
  Exit_Payload,
  Exit_Price_Payload,
  Indicator_Payload,
  Operand_Payload,
  Price_Field,
  Side,
  Simulation_Payload,
} from '../../../../Hooks/Trading/useSimulation';
import { isInteger, isNumber, optionsPayload, scheduleOk, schedulePayload } from './strategyOptions';
import {
  isBetween,
  type Take_Mode,
  MAX_WITHIN,
  contextHasScope,
  contextIsPct,
  isCountKind,
  WINDOW_SOURCES,
  isRangeLevel,
  type Value_Form,
  isNonPriceValue,
  isSimulationKind,
  isProfile,
  type Indicator_Form,
  shiftOf,
  smoothingOf,
  type Condition_Form,
  flatConditions,
  conditionValues,
  type Entry_Form,
  type Simulation_Form_State,
  toNumber,
  optionalNumber,
  optionalName,
} from './formState';
import { validPeriod } from './formDefaults';

// --- do formulário para o pedido -------------------------------------------

const valuePayload = (form: Value_Form, indicators: Indicator_Form[]): Exit_Price_Payload => {
  if (form.kind === 'market') return { kind: 'market' };
  if (form.kind === 'number') return { kind: 'number', value: toNumber(form.value) };
  if (form.kind === 'session') {
    return {
      kind: 'session',
      level: form.level,
      ...(isRangeLevel(form.level) ? { rangeStart: form.rangeStart, rangeMinutes: toNumber(form.rangeMinutes) } : {}),
    };
  }

  // Da última fechada (-2) para trás
  const offset = -2 - form.back;
  if (form.kind === 'window') {
    // As contagens leem o fecho e a abertura de cada vela (o campo é só para o backend)
    const field = isCountKind(form.windowKind)
      ? 'close'
      : WINDOW_SOURCES.includes(form.source as Price_Field)
        ? (form.source as Price_Field)
        : 'high';
    return {
      kind: form.windowKind,
      field,
      period: toNumber(form.period),
      offset,
      ...(form.timeframe ? { timeframe: form.timeframe } : {}),
    };
  }
  if (form.kind === 'indicator') {
    const indicator = indicators.find((item) => item.id === form.indicatorId)!;
    if (isProfile(indicator.kind)) return profilePayload(form, indicator);
    const smoothing = form.line === 'average' ? smoothingOf(indicator) : null;
    return {
      kind: indicator.kind,
      field: indicator.field,
      period: toNumber(indicator.period),
      // Uma média deslocada N velas para a direita é a de há N velas
      offset: offset - shiftOf(indicator),
      ...(indicator.timeframe ? { timeframe: indicator.timeframe } : {}),
      indicator: indicator.id,
      ...(smoothing ? { smoothing } : {}),
    };
  }

  const timeframe = form.timeframe ? { timeframe: form.timeframe } : {};
  if (form.source === 'open_current') return { kind: 'price', field: 'open', offset: -1, ...timeframe };
  return { kind: 'price', field: form.source, offset, ...timeframe };
};

/**
 * Um valor do perfil de volume: o nível, de que sessão e as opções do indicador.
 * O perfil faz-se das velas já fechadas, por isso a "última fechada" é a -1 do
 * motor (o que se sabe na abertura da vela), não a -2 dos outros valores.
 */
const profilePayload = (form: Value_Form, indicator: Indicator_Form): Exit_Price_Payload => ({
  kind: 'profile',
  indicator: indicator.id,
  profileLevel: form.profileLevel,
  profile: form.profileSource,
  ...(form.profileSource === 'session' ? { sessionsBack: toNumber(form.sessionsBack) || 1 } : {}),
  ...profileOptions(indicator),
  offset: -1 - form.back,
});

// As opções do indicador, como vão no pedido (no indicador e em cada uso)
const profileOptions = (indicator: Indicator_Form) => ({
  session: indicator.session,
  ...(indicator.session === 'custom' ? { customSession: indicator.customSession.trim() } : {}),
  ...(indicator.exchange ? { exchange: indicator.exchange } : {}),
  rowsLayout: indicator.rowsLayout,
  rowSize: toNumber(indicator.rowSize),
  vaPct: toNumber(indicator.vaPct),
});

const withinPayload = (condition: Condition_Form) =>
  condition.withinMode ? { within: { mode: condition.withinMode, bars: toNumber(condition.withinBars) } } : {};

const comparisonPayload = (condition: Condition_Form, indicators: Indicator_Form[]): Comparison_Payload => ({
  left: valuePayload(condition.left, indicators) as Operand_Payload,
  operator: condition.operator,
  right: valuePayload(condition.right, indicators) as Operand_Payload,
  ...(isBetween(condition.operator)
    ? { rightTo: valuePayload(condition.rightTo, indicators) as Operand_Payload }
    : {}),
  ...(toNumber(condition.rightPct) ? { rightPct: toNumber(condition.rightPct) } : {}),
  ...withinPayload(condition),
});

const conditionPayload = (condition: Condition_Form, indicators: Indicator_Form[]): Condition_Payload =>
  condition.group
    ? {
        conditions: condition.group.map((item) => comparisonPayload(item, indicators)),
        match: condition.groupMatch,
        ...withinPayload(condition),
      }
    : comparisonPayload(condition, indicators);

// A favor em R ou em %, como vai no pedido
const profitPayload = (mode: Take_Mode, text: string) =>
  mode === 'r' ? { r: toNumber(text), pct: null } : { pct: toNumber(text), r: null };

// A preparação, as condições da conta, os ajustes do stop e os reforços
const rulesPayload = (entry: Entry_Form, indicators: Indicator_Form[]) => {
  const conditions = (items: Condition_Form[]) => items.map((condition) => conditionPayload(condition, indicators));
  return {
    setup: entry.setup
      ? {
          conditions: conditions(entry.setup.conditions),
          match: entry.setup.match,
          bars: toNumber(entry.setup.bars),
          cancel: entry.setup.cancel.length ? conditions(entry.setup.cancel) : null,
          cancelMatch: entry.setup.cancelMatch,
        }
      : null,
    context: entry.context.map((rule) => ({
      kind: rule.kind,
      ...(contextHasScope(rule.kind) ? { scope: rule.scope } : {}),
      ...(rule.kind === 'lastTrade' ? { result: rule.result } : { operator: rule.operator, value: toNumber(rule.value) }),
    })),
    stopRules: entry.stopRules.map((rule) => ({
      trigger: rule.trigger,
      ...(rule.trigger === 'profit' ? profitPayload(rule.profitMode, rule.profitValue) : {}),
      ...(rule.trigger === 'conditions' ? { conditions: conditions(rule.conditions), match: rule.match } : {}),
      to: rule.to,
      ...(rule.to === 'swing' ? { bars: toNumber(rule.bars) } : {}),
      ...(rule.to === 'level' ? { level: valuePayload(rule.level, indicators) } : {}),
      ...(rule.to === 'trail' ? { trailPct: toNumber(rule.trailPct) } : {}),
      ...(rule.to === 'swing' || rule.to === 'level' ? { bufferPct: optionalNumber(rule.bufferPct) } : {}),
    })),
    scaleIns: entry.scaleIns.map((add) => ({
      name: optionalName(add.name),
      trigger: add.trigger,
      ...(add.trigger === 'profit' ? profitPayload(add.profitMode, add.profitValue) : {}),
      ...(add.trigger === 'conditions' ? { conditions: conditions(add.conditions), match: add.match } : {}),
      sizePct: toNumber(add.sizePct),
      moveStop: add.moveStop,
    })),
  };
};

/** Se a entrada tem stop: a % escrita, ou a mínima/máxima ou um nível. */
export const hasStop = (entry: Entry_Form) => entry.stopMode !== 'pct' || entry.stopLossPct.trim() !== '';

/** Se a entrada tem take profit: em % ou em R. */
export const hasTake = (entry: Entry_Form) =>
  (entry.takeMode === 'r' ? entry.takeR : entry.takeProfitPct).trim() !== '';

// O stop e o take profit como vão no pedido (só os campos do modo escolhido)
const stopPayload = (entry: Entry_Form, indicators: Indicator_Form[]) => ({
  stopLossMode: entry.stopMode,
  stopLossPct: entry.stopMode === 'pct' ? optionalNumber(entry.stopLossPct) : null,
  ...(entry.stopMode === 'swing' ? { stopLossBars: toNumber(entry.stopBars) } : {}),
  ...(entry.stopMode === 'level' ? { stopLossLevel: valuePayload(entry.stopLevel, indicators) } : {}),
  ...(entry.stopMode !== 'pct' ? { stopLossBufferPct: optionalNumber(entry.stopBufferPct) } : {}),
  takeProfitPct: entry.takeMode === 'pct' ? optionalNumber(entry.takeProfitPct) : null,
  takeProfitR: entry.takeMode === 'r' ? optionalNumber(entry.takeR) : null,
  partialExits: entry.partials.map((part) => ({
    name: optionalName(part.name),
    closePct: toNumber(part.closePct),
    pct: part.mode === 'pct' ? toNumber(part.value) : null,
    r: part.mode === 'r' ? toNumber(part.value) : null,
    moveStop: part.moveStop,
  })),
});

// No spot não há venda a descoberto: as entradas de venda passam a compra
export const effectiveSide = (entry: Entry_Form, spot: boolean): Side => (spot ? 'long' : entry.side);

// As posições desta entrada só contam com várias posições ligadas
const pyramidOf = (form: Simulation_Form_State) => form.options.enabled.includes('positions');

export const entryPayload = (
  entry: Entry_Form,
  spot: boolean,
  indicators: Indicator_Form[],
  pyramid = false,
  futures = false,
): Entry_Payload => ({
  name: optionalName(entry.name),
  side: effectiveSide(entry, spot),
  conditions: entry.conditions.map((condition) => conditionPayload(condition, indicators)),
  match: entry.match,
  price: valuePayload(entry.price, indicators),
  ...stopPayload(entry, indicators),
  ...rulesPayload(entry, indicators),
  stopLossName: optionalName(entry.stopLossName),
  takeProfitName: optionalName(entry.takeProfitName),
  exits: entry.exits.map(
    (exit): Exit_Payload => ({
      name: optionalName(exit.name),
      conditions: exit.conditions.map((condition) => conditionPayload(condition, indicators)),
      match: exit.match,
      price: valuePayload(exit.price, indicators),
      schedule: schedulePayload(exit.schedule),
    }),
  ),
  sizing: entry.sizingMode === 'all' ? { mode: 'all' } : { mode: entry.sizingMode, value: toNumber(entry.sizingValue) },
  leverage: futures ? toNumber(entry.leverage || '1') : null,
  schedule: schedulePayload(entry.schedule),
  stopLossSchedule: schedulePayload(entry.stopSchedule),
  takeProfitSchedule: schedulePayload(entry.takeSchedule),
  trailingStopPct: optionalNumber(entry.trailingPct),
  breakEvenPct: optionalNumber(entry.breakEvenPct),
  maxBars: optionalNumber(entry.maxBars),
  // A validade e o resto só valem num nível (ao mercado entra logo)
  ...(entry.price.kind !== 'market'
    ? { orderBars: toNumber(entry.orderBars || '1'), orderTrack: entry.orderTrack, orderCancel: entry.orderCancel }
    : {}),
  ...(pyramid ? { maxPositions: toNumber(entry.maxPositions || '1') } : {}),
});

/** Cada entrada tem de ter como fechar: stop, take profit, trailing, tempo ou uma saída. */
export const entryCanClose = (entry: Entry_Form) =>
  entry.exits.length > 0 ||
  entry.stopRules.length > 0 ||
  hasStop(entry) ||
  hasTake(entry) ||
  [entry.trailingPct, entry.maxBars].some((text) => text.trim() !== '');

/** Todas as listas de condições de uma entrada: as dela, as da preparação, as das
 * saídas, as dos ajustes do stop e as dos reforços (só as que vão no pedido). */
export const conditionLists = (entry: Entry_Form): Condition_Form[][] => [
  entry.conditions,
  ...(entry.setup ? [entry.setup.conditions, entry.setup.cancel] : []),
  ...entry.exits.map((exit) => exit.conditions),
  ...entry.stopRules.filter((rule) => rule.trigger === 'conditions').map((rule) => rule.conditions),
  ...entry.scaleIns.filter((add) => add.trigger === 'conditions').map((add) => add.conditions),
];

// Todos os valores da estratégia, para ver que indicadores estão em uso
const allValues = (entries: Entry_Form[]) =>
  entries.flatMap((entry) => [
    entry.price,
    ...(entry.stopMode === 'level' ? [entry.stopLevel] : []),
    ...entry.stopRules.filter((rule) => rule.to === 'level').map((rule) => rule.level),
    ...entry.exits.map((exit) => exit.price),
    ...conditionLists(entry).flat().flatMap(conditionValues),
  ]);

export const indicatorInUse = (entries: Entry_Form[], id: string) =>
  allValues(entries).some((item) => item.kind === 'indicator' && item.indicatorId === id);

/** Um indicador de um tipo que já não se simula (de uma simulação antiga) tem de mudar. */
export const unavailableIndicators = (form: Simulation_Form_State) =>
  form.indicators.some((indicator) => !isSimulationKind(indicator.kind));

/** Um valor que aponta para um indicador apagado (ou nenhum) não se pode simular. */
export const missingIndicators = (form: Simulation_Form_State) =>
  allValues(form.entries).some(
    (item) => item.kind === 'indicator' && !form.indicators.some((indicator) => indicator.id === item.indicatorId),
  );

// A comissão de cada lado, pelo modo escolhido
const feesOf = (form: Simulation_Form_State) => {
  const fee = toNumber(form.feePct || '0');
  if (form.feeMode === 'entry') return { feeEntryPct: fee, feeExitPct: 0 };
  if (form.feeMode === 'exit') return { feeEntryPct: 0, feeExitPct: fee };
  if (form.feeMode === 'custom') return { feeEntryPct: fee, feeExitPct: toNumber(form.feeExitPct || '0') };
  return { feeEntryPct: fee, feeExitPct: fee };
};

/** O valor do tamanho da entrada está bem para o modo (tudo não tem valor). */
export const validSizing = (entry: Entry_Form) => {
  if (entry.sizingMode === 'all') return true;
  return isNumber(entry.sizingValue, 0.01, entry.sizingMode === 'percent' ? 100 : Infinity);
};

/** O risco fixo mede-se até ao stop: a entrada precisa de um. */
export const riskNeedsStop = (entry: Entry_Form) => entry.sizingMode === 'risk' && !hasStop(entry);

/** O stop noutro modo, o take em R e as saídas parciais (a chave da tradução), ou null. */
const stopProblem = (form: Simulation_Form_State, entry: Entry_Form) => {
  const optional = (text: string, min: number, max: number) => text.trim() === '' || isNumber(text, min, max);
  if (entry.stopMode === 'swing' && !isInteger(entry.stopBars, 1, 500)) return 'trading.invalidStopBars';
  if (entry.stopMode === 'level') {
    const level = entry.stopLevel;
    if (level.kind === 'market' || isNonPriceValue(level, form.indicators)) return 'trading.invalidStopLevel';
  }
  if (entry.stopMode !== 'pct' && !optional(entry.stopBufferPct, 0, 20)) return 'trading.invalidStopBuffer';
  if (entry.stopMode === 'pct' && !optional(entry.stopLossPct, 0.01, 99)) return 'trading.invalidStop';
  if (entry.takeMode === 'r' && hasTake(entry)) {
    if (!isNumber(entry.takeR, 0.1, 50)) return 'trading.invalidTakeR';
    if (!hasStop(entry)) return 'trading.takeRNeedsStop';
  }
  if (entry.partials.length) {
    const total = entry.partials.reduce((sum, part) => sum + toNumber(part.closePct), 0);
    const bad = entry.partials.some(
      (part) =>
        !isNumber(part.closePct, 1, 99) ||
        !(part.mode === 'r' ? isNumber(part.value, 0.1, 50) : isNumber(part.value, 0.01, 1000)),
    );
    if (bad || total >= 100) return 'trading.invalidPartial';
    if (entry.partials.some((part) => part.mode === 'r') && !hasStop(entry)) return 'trading.partialRNeedsStop';
  }
  return null;
};

// Um valor que não pode ser um preço: um RSI, uma contagem de velas, o delta ou o volume da linha do perfil
const notAPrice = (form: Simulation_Form_State, price: Value_Form) => isNonPriceValue(price, form.indicators);

/** A preparação, os ajustes do stop, os reforços e a conta (a chave da tradução), ou null. */
const rulesProblem = (form: Simulation_Form_State, entry: Entry_Form) => {
  const optional = (text: string, min: number, max: number) => text.trim() === '' || isNumber(text, min, max);
  const profitOk = (mode: Take_Mode, text: string) => (mode === 'r' ? isNumber(text, 0.1, 50) : isNumber(text, 0.01, 1000));
  if (entry.setup && !isInteger(entry.setup.bars, 1, 500)) return 'trading.invalidSetup';
  for (const rule of entry.stopRules) {
    if (rule.trigger === 'profit' && !profitOk(rule.profitMode, rule.profitValue)) return 'trading.invalidStopRule';
    if (rule.trigger === 'profit' && rule.profitMode === 'r' && !hasStop(entry)) return 'trading.stopRuleRNeedsStop';
    if (rule.to === 'swing' && !isInteger(rule.bars, 1, 500)) return 'trading.invalidStopRule';
    if (rule.to === 'trail' && !isNumber(rule.trailPct, 0.01, 99)) return 'trading.invalidStopRule';
    if ((rule.to === 'swing' || rule.to === 'level') && !optional(rule.bufferPct, 0, 20)) return 'trading.invalidStopRule';
    if (rule.to === 'level' && (rule.level.kind === 'market' || notAPrice(form, rule.level))) return 'trading.invalidStopLevel';
  }
  for (const add of entry.scaleIns) {
    if (!isNumber(add.sizePct, 1, 500)) return 'trading.invalidScaleIn';
    if (add.trigger === 'profit' && !profitOk(add.profitMode, add.profitValue)) return 'trading.invalidScaleIn';
    if (add.trigger === 'profit' && add.profitMode === 'r' && !hasStop(entry)) return 'trading.scaleInRNeedsStop';
  }
  for (const rule of entry.context) {
    if (rule.kind === 'lastTrade') continue;
    const ok = contextIsPct(rule.kind) ? isNumber(rule.value, -1000, 1000) : isInteger(rule.value, 0, 1000);
    if (!ok) return 'trading.invalidContext';
  }
  return null;
};

/** O que está mal numa entrada fora das condições (a chave da tradução), ou null. */
// Os valores do perfil de volume de uma entrada (condições, preços, stop, saídas, regras)
export const profileValuesOf = (entry: Entry_Form, indicators: Indicator_Form[]) => {
  const found: Value_Form[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') {
      const item = node as Record<string, unknown>;
      if ('profileLevel' in item && 'indicatorId' in item && 'kind' in item) {
        const form = item as unknown as Value_Form;
        if (form.kind === 'indicator' && indicators.some((other) => other.id === form.indicatorId && isProfile(other.kind))) {
          found.push(form);
        }
      } else Object.values(item).forEach(walk);
    }
  };
  walk(entry);
  return found;
};

export const entryProblem = (form: Simulation_Form_State, entry: Entry_Form) => {
  if (!entryCanClose(entry)) return 'trading.exitRequired';
  // Nas velas diárias cada vela é uma sessão: em desenvolvimento nunca há velas da sessão fechadas
  if (form.timeframe === '1d' && profileValuesOf(entry, form.indicators).some((item) => item.profileSource === 'developing')) {
    return 'trading.profileDevelopingDaily';
  }
  if (!validSizing(entry)) return 'trading.invalidSizing';
  if (riskNeedsStop(entry)) return 'trading.riskNeedsStop';
  const stop = stopProblem(form, entry);
  if (stop) return stop;
  const rules = rulesProblem(form, entry);
  if (rules) return rules;
  if (form.instrument?.type !== 'spot' && !isNumber(entry.leverage, 1, 125)) return 'trading.optError_leverage';
  if (!isInteger(entry.orderBars || '1', 1, 500)) return 'trading.invalidOrderBars';
  if (pyramidOf(form) && !isInteger(entry.maxPositions || '1', 1, Number(form.options.maxPositions) || 1)) {
    return 'trading.invalidPositions';
  }
  const optional = (text: string, min: number, max: number) => text.trim() === '' || isNumber(text, min, max);
  if (!optional(entry.trailingPct, 0.01, 99) || !optional(entry.breakEvenPct, 0.01, 1000)) {
    return 'trading.invalidTrailing';
  }
  if (entry.maxBars.trim() !== '' && !isInteger(entry.maxBars, 1, 100000)) return 'trading.invalidMaxBars';
  const schedules = [entry.schedule, entry.stopSchedule, entry.takeSchedule, ...entry.exits.map((exit) => exit.schedule)];
  if (!schedules.every(scheduleOk)) return 'trading.optError_schedule';
  const grouped = conditionLists(entry).flat();
  const conditions = flatConditions(grouped);
  if (!conditions.every((condition) => condition.rightPct.trim() === '' || isNumber(condition.rightPct, -50, 100))) {
    return 'trading.invalidRightPct';
  }
  if ([...grouped, ...conditions].some((condition) => condition.withinMode && !isInteger(condition.withinBars, 2, MAX_WITHIN))) {
    return 'trading.invalidWithin';
  }
  // Um indicador que passou a RSI depois de escolhido como preço (ou uma contagem de velas)
  if ([entry.price, ...entry.exits.map((exit) => exit.price)].some((price) => notAPrice(form, price))) {
    return 'trading.rsiNotPrice';
  }
  const badPeriod = (item: Value_Form) => item.kind === 'window' && !validPeriod(item.period);
  const badRange = (item: Value_Form) =>
    item.kind === 'session' &&
    isRangeLevel(item.level) &&
    (!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.rangeStart) || !isInteger(item.rangeMinutes, 1, 720));
  const values = [
    entry.price,
    entry.stopLevel,
    ...entry.exits.map((exit) => exit.price),
    ...entry.stopRules.map((rule) => rule.level),
    ...conditions.flatMap(conditionValues),
  ];
  if (values.some(badPeriod)) return 'trading.invalidWindowPeriod';
  if (values.some(badRange)) return 'trading.invalidOpeningRange';
  // A linha da média de um RSI a que tiraram a média
  const averageGone = (item: Value_Form) =>
    item.kind === 'indicator' &&
    item.line === 'average' &&
    form.indicators.some((indicator) => indicator.id === item.indicatorId && !smoothingOf(indicator));
  if (conditions.some((condition) => conditionValues(condition).some(averageGone))) {
    return 'trading.rsiAverageGone';
  }
  return null;
};

export const toPayload = (form: Simulation_Form_State): Simulation_Payload => ({
  instrumentId: form.instrument!.id,
  timeframe: form.timeframe,
  from: form.from,
  to: form.to,
  initialCapital: toNumber(form.initialCapital),
  feePct: toNumber(form.feePct || '0'),
  feeMode: form.feeMode,
  ...feesOf(form),
  ...optionsPayload(form.options, form.instrument),
  compounding: form.compounding,
  indicators: form.indicators.map(
    (indicator): Indicator_Payload => isProfile(indicator.kind) ? {
      id: indicator.id,
      name: optionalName(indicator.name),
      kind: indicator.kind,
      ...profileOptions(indicator),
      volume: indicator.volume,
    } : ({
      id: indicator.id,
      name: optionalName(indicator.name),
      kind: indicator.kind,
      period: toNumber(indicator.period),
      field: indicator.field,
      ...(indicator.timeframe ? { timeframe: indicator.timeframe } : {}),
      ...(shiftOf(indicator) ? { shift: shiftOf(indicator) } : {}),
      smoothing: smoothingOf(indicator),
    }),
  ),
  entries: form.entries.map((entry) =>
    entryPayload(
      entry,
      form.instrument?.type === 'spot',
      form.indicators,
      pyramidOf(form),
      Boolean(form.instrument && form.instrument.type !== 'spot'),
    ),
  ),
});
