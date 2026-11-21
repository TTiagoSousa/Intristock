import type { Condition_Match, Operator, Profile_Level, Side } from '../../../../Hooks/Trading/useSimulation';
import { defaultOptions, isInteger, isNumber } from './strategyOptions';
import {
  profileSessionExists,
  MAX_PROFILE_ROWS,
  validSessionRanges,
  type Candle_Source,
  CANDLE_SOURCES,
  type Value_Form,
  isProfile,
  hasShift,
  MAX_SHIFT,
  type Indicator_Form,
  smoothingOf,
  type Condition_Form,
  type Partial_Form,
  type Setup_Form,
  type Stop_Rule_Form,
  type Scale_In_Form,
  type Context_Form,
  type Exit_Form,
  type Entry_Form,
  type Simulation_Form_State,
  DAY_MS,
  toNumber,
} from './formState';

// Os valores novos de cada parte do formulário, o formulário por omissão e a validação dos indicadores

let nextId = 1;
export const newId = () => nextId++;

// Os ids dos indicadores ficam gravados na estratégia: não podem repetir os de
// uma simulação aberta, por isso não vêm do contador
const newIndicatorId = () => `ind-${Math.random().toString(36).slice(2, 10)}`;

export const value = (patch: Partial<Value_Form>): Value_Form => ({
  kind: 'candle',
  source: 'close',
  indicatorId: '',
  back: 0,
  timeframe: '',
  value: '0',
  line: 'value',
  windowKind: 'highest',
  period: '20',
  level: 'day_high',
  rangeStart: '09:00',
  rangeMinutes: '60',
  profileLevel: 'poc',
  profileSource: 'session',
  sessionsBack: '1',
  ...patch,
});

export const newIndicator = (patch: Partial<Indicator_Form> = {}): Indicator_Form => ({
  id: newIndicatorId(),
  name: '',
  kind: 'sma',
  period: '21',
  field: 'close',
  timeframe: '',
  shift: '0',
  smoothing: '',
  smoothingPeriod: '14',
  session: 'each',
  customSession: '0930-1600',
  exchange: '',
  rowsLayout: 'rows',
  rowSize: '24',
  volume: 'updown',
  vaPct: '70',
  ...patch,
});

// "Se o fecho estiver acima da média" (a primeira dos indicadores), ou de um
// valor fixo se ainda não houver indicadores
export const newCondition = (indicators: Indicator_Form[]): Condition_Form => ({
  id: newId(),
  left: value({ kind: 'candle', source: 'close' }),
  operator: 'gt',
  right: indicators.length ? value({ kind: 'indicator', indicatorId: indicators[0].id }) : value({ kind: 'number' }),
  rightTo: value({ kind: 'number', value: '70' }),
  rightPct: '',
  withinMode: '',
  withinBars: '3',
  group: null,
  groupMatch: 'all',
});

// Um grupo com uma condição; junta-se ao contrário da lista onde entra ("A e (B ou C)")
export const newGroup = (indicators: Indicator_Form[], outer: Condition_Match): Condition_Form => ({
  ...newCondition(indicators),
  group: [newCondition(indicators)],
  groupMatch: outer === 'all' ? 'any' : 'all',
});

/**
 * O fecho dentro da área de valor da sessão anterior (entre o VAL e o VAH) ou
 * fora dela (acima do VAH ou abaixo do VAL: um grupo "ou"), do perfil `profileId`.
 * Ficam condições como as outras, que se mudam à vontade.
 */
export const newValueAreaCondition = (profileId: string, inside: boolean): Condition_Form => {
  const level = (profileLevel: Profile_Level) =>
    value({ kind: 'indicator', indicatorId: profileId, profileLevel, profileSource: 'session' });
  const comparison = (operator: Operator, right: Value_Form): Condition_Form => ({
    id: newId(),
    left: value({ kind: 'candle', source: 'close' }),
    operator,
    right,
    rightTo: level('vah'),
    rightPct: '',
    withinMode: '',
    withinBars: '3',
    group: null,
    groupMatch: 'all',
  });
  if (inside) return comparison('between', level('val'));
  return { ...comparison('gt', level('vah')), group: [comparison('gt', level('vah')), comparison('lt', level('val'))], groupMatch: 'any' };
};

export const newPartial = (patch: Partial<Partial_Form> = {}): Partial_Form => ({
  id: newId(),
  name: '',
  closePct: '50',
  mode: 'pct',
  value: '1',
  moveStop: true,
  ...patch,
});

// "Primeiro o fecho abaixo da média", armada 5 velas
export const newSetup = (indicators: Indicator_Form[]): Setup_Form => ({
  conditions: [{ ...newCondition(indicators), operator: 'lt' }],
  match: 'all',
  bars: '5',
  cancel: [],
  cancelMatch: 'all',
});

// A 1R a favor o stop passa à entrada
export const newStopRule = (indicators: Indicator_Form[]): Stop_Rule_Form => ({
  id: newId(),
  trigger: 'profit',
  profitMode: 'r',
  profitValue: '1',
  conditions: [newCondition(indicators)],
  match: 'all',
  to: 'entry',
  bars: '3',
  level: value({ kind: 'candle', source: 'low' }),
  trailPct: '1',
  bufferPct: '',
});

// Junta metade da posição a 1R a favor
export const newScaleIn = (indicators: Indicator_Form[]): Scale_In_Form => ({
  id: newId(),
  name: '',
  trigger: 'profit',
  profitMode: 'r',
  profitValue: '1',
  conditions: [newCondition(indicators)],
  match: 'all',
  sizePct: '50',
  moveStop: false,
});

// No máximo 3 trades por dia (volta a zero todos os dias: não trava de vez)
export const newContext = (): Context_Form => ({
  id: newId(),
  kind: 'tradesToday',
  scope: 'all',
  operator: 'lt',
  value: '3',
  result: 'loss',
});

// Uma entrada ou saída nova começa ao mercado (a abertura da vela seguinte)
export const newExit = (indicators: Indicator_Form[]): Exit_Form => ({
  id: newId(),
  name: '',
  conditions: [newCondition(indicators)],
  match: 'all',
  price: value({ kind: 'market' }),
  schedule: null,
});

export const newEntry = (indicators: Indicator_Form[], side: Side = 'long'): Entry_Form => ({
  id: newId(),
  name: '',
  side,
  conditions: [newCondition(indicators)],
  match: 'all',
  setup: null,
  context: [],
  price: value({ kind: 'market' }),
  stopMode: 'pct',
  stopLossPct: '2',
  stopBars: '10',
  stopLevel: value({ kind: 'candle', source: 'low' }),
  stopBufferPct: '',
  stopLossName: '',
  takeMode: 'pct',
  takeProfitPct: '4',
  takeR: '2',
  takeProfitName: '',
  partials: [],
  stopRules: [],
  scaleIns: [],
  exits: [],
  orderBars: '1',
  orderTrack: false,
  orderCancel: false,
  maxPositions: '1',
  sizingMode: 'all',
  sizingValue: '',
  leverage: '1',
  schedule: null,
  stopSchedule: null,
  takeSchedule: null,
  trailingPct: '',
  breakEvenPct: '',
  maxBars: '',
});

// Uma cópia de uma entrada, com ids novos (nela e nas condições e saídas)
export const copyEntry = (entry: Entry_Form): Entry_Form => {
  const copyConditions = (conditions: Condition_Form[]): Condition_Form[] =>
    conditions.map((condition) => ({
      ...condition,
      id: newId(),
      group: condition.group ? copyConditions(condition.group) : null,
    }));
  return {
    ...entry,
    id: newId(),
    conditions: copyConditions(entry.conditions),
    setup: entry.setup
      ? { ...entry.setup, conditions: copyConditions(entry.setup.conditions), cancel: copyConditions(entry.setup.cancel) }
      : null,
    context: entry.context.map((rule) => ({ ...rule, id: newId() })),
    stopRules: entry.stopRules.map((rule) => ({ ...rule, id: newId(), conditions: copyConditions(rule.conditions) })),
    scaleIns: entry.scaleIns.map((add) => ({ ...add, id: newId(), conditions: copyConditions(add.conditions) })),
    partials: entry.partials.map((part) => ({ ...part, id: newId() })),
    exits: entry.exits.map((exit) => ({ ...exit, id: newId(), conditions: copyConditions(exit.conditions) })),
  };
};

// A lista com o item de `from` levado para `to`
export const moveItem = <T>(items: T[], from: number, to: number) => {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

// 'YYYY-MM-DD' no dia local, que é o que o <input type="date"> usa
export const toDateInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};
const DEFAULT_DAYS = 90;
// A comissão de um formulário novo, antes de se escolher o mercado (depois, a da corretora dele)
export const DEFAULT_FEE_PCT = 0.1;

export const defaultForm = (): Simulation_Form_State => {
  const indicators = [newIndicator()];
  return {
    instrument: null,
    timeframe: '1h',
    from: toDateInput(new Date(Date.now() - DEFAULT_DAYS * DAY_MS)),
    to: toDateInput(new Date()),
    initialCapital: '1000',
    feePct: String(DEFAULT_FEE_PCT),
    feeMode: 'both',
    feeExitPct: String(DEFAULT_FEE_PCT),
    compounding: true,
    options: defaultOptions(),
    indicators,
    entries: [newEntry(indicators)],
  };
};

/** O que se pode ler de uma vela: num preço de entrada ou saída, nem o volume nem a abertura atual (é o mercado). */
export const candleSources = (priceOnly: boolean): Candle_Source[] =>
  priceOnly ? CANDLE_SOURCES.filter((source) => source !== 'volume' && source !== 'open_current') : CANDLE_SOURCES;

export const validPeriod = (period: string) => {
  const number = toNumber(period);
  return Number.isInteger(number) && number >= 2 && number <= 500;
};

/** O que está mal num indicador (a chave da tradução), ou null. */
export const indicatorProblem = (indicator: Indicator_Form) => {
  if (isProfile(indicator.kind)) {
    if (!isInteger(indicator.rowSize, 1, MAX_PROFILE_ROWS)) return 'trading.invalidProfileRows';
    if (!isNumber(indicator.vaPct, 1, 100)) return 'trading.invalidProfileVa';
    if (indicator.session === 'custom' && !validSessionRanges(indicator.customSession.trim())) {
      return 'trading.invalidProfileSession';
    }
    if (!profileSessionExists(indicator.session, indicator.exchange)) return 'trading.profileSessionMissing';
    return null;
  }
  if (!validPeriod(indicator.period)) return 'trading.invalidPeriod';
  if (hasShift(indicator.kind) && !isInteger(indicator.shift || '0', 0, MAX_SHIFT)) return 'trading.invalidShift';
  if (smoothingOf(indicator) && !validPeriod(indicator.smoothingPeriod)) return 'trading.invalidSmoothingPeriod';
  return null;
};
