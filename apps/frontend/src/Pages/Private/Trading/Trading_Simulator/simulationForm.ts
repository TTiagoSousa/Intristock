import type { Market_Instrument } from '../../../../Hooks/Trading/useMarketInstruments';
import { isGroupPayload } from '../../../../Hooks/Trading/useSimulation';
import type {
  Comparison_Payload,
  Condition_Match,
  Condition_Payload,
  Context_Kind,
  Context_Operator,
  Context_Scope,
  Entry_Payload,
  Exit_Payload,
  Fee_Mode,
  Exit_Price_Payload,
  Indicator_Kind,
  Indicator_Payload,
  Operand_Payload,
  Operator,
  Price_Field,
  Profile_Exchange,
  Profile_Level,
  Profile_Rows_Layout,
  Profile_Session,
  Profile_Source,
  Profile_Volume,
  Side,
  Scale_In_Trigger,
  Session_Level,
  Simulation_Payload,
  Simulation_Run,
  Sizing_Mode,
  Smoothing_Kind,
  Stop_Mode,
  Stop_Rule_Target,
  Stop_Rule_Trigger,
  Timeframe,
  Trade_Result,
  Window_Kind,
  Within_Mode,
} from '../../../../Hooks/Trading/useSimulation';
import {
  defaultOptions,
  isInteger,
  isNumber,
  optionsFromStrategy,
  optionsPayload,
  scheduleForm,
  scheduleOk,
  schedulePayload,
} from './strategyOptions';
import type { Options_Form, Schedule_Form } from './strategyOptions';

/**
 * O formulário do simulador: o estado em que se edita, os valores por omissão
 * e a passagem para o pedido (e de volta, ao abrir uma simulação pelo URL).
 *
 * No ecrã não há velas -1/-2: as condições veem-se com as velas fechadas, por
 * isso "Fecho" é o da última vela fechada (-2 no motor), "há 1 vela" a anterior
 * (-3) e a "Abertura atual" é a abertura da vela que está a começar (-1, a única
 * coisa que se sabe dela). As médias definem-se uma vez, como indicadores, e
 * usam-se pelo nome; no pedido cada uso vira uma média com os valores dele.
 */

export const TIMEFRAMES: Timeframe[] = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'];
export const PRICE_FIELDS: Price_Field[] = ['open', 'high', 'low', 'close', 'volume'];
export const FEE_MODES: Fee_Mode[] = ['both', 'entry', 'exit', 'custom'];
export const SIZING_MODES: Sizing_Mode[] = ['all', 'percent', 'amount', 'risk'];
export const OPERATORS: Operator[] = ['gt', 'gte', 'lt', 'lte', 'cross_above', 'cross_below', 'between'];

// "Entre" compara com dois limites: o lado direito e o rightTo
export const isBetween = (operator: Operator) => operator === 'between';

export const STOP_MODES: Stop_Mode[] = ['pct', 'swing', 'level'];
export type Take_Mode = 'pct' | 'r';
export const TAKE_MODES: Take_Mode[] = ['pct', 'r'];
export const WITHIN_MODES: Within_Mode[] = ['any', 'all'];
// "Nas últimas N velas" (o backend aceita de 2 a 200)
export const MAX_WITHIN = 200;
export const MAX_PARTIALS = 3;
// Ajustes do stop, reforços e condições da conta de cada entrada
export const MAX_STOP_RULES = 5;
export const MAX_SCALE_INS = 3;
export const MAX_CONTEXT_RULES = 5;
export const STOP_RULE_TRIGGERS: Stop_Rule_Trigger[] = ['always', 'profit', 'conditions'];
export const STOP_RULE_TARGETS: Stop_Rule_Target[] = ['entry', 'swing', 'level', 'trail'];
export const SCALE_IN_TRIGGERS: Scale_In_Trigger[] = ['profit', 'conditions'];
export const CONTEXT_KINDS: Context_Kind[] = [
  'lastTrade',
  'lossStreak',
  'winStreak',
  'openPositions',
  'tradesToday',
  'dayPnlPct',
  'drawdownPct',
];
export const CONTEXT_OPERATORS: Context_Operator[] = ['lt', 'lte', 'eq', 'gte', 'gt'];
// As da conta que se podem contar só nesta entrada (as outras são da conta toda)
export const contextHasScope = (kind: Context_Kind) => !['dayPnlPct', 'drawdownPct'].includes(kind);
export const contextIsPct = (kind: Context_Kind) => kind === 'dayPnlPct' || kind === 'drawdownPct';
// As que dependem só dos trades fechados: sem trades novos não mudam, por isso podem travar de vez
export const contextCanStick = (kind: Context_Kind) => ['lastTrade', 'lossStreak', 'winStreak', 'drawdownPct'].includes(kind);

// Os valores das últimas N velas: a máxima e a mínima (de um campo) e as velas verdes/vermelhas
export const WINDOW_KINDS: Window_Kind[] = ['highest', 'lowest', 'bullish', 'bearish'];
// As contagens não são preços (vão de 0 a N)
export const isCountKind = (kind: Window_Kind) => kind === 'bullish' || kind === 'bearish';
const isWindowKind = (kind: string): kind is Window_Kind => (WINDOW_KINDS as string[]).includes(kind);
// Os campos de que se tira a máxima ou a mínima de N velas
export const WINDOW_SOURCES: Price_Field[] = ['high', 'low', 'close', 'open'];
// Os níveis do dia e da semana (na hora local da estratégia)
export const SESSION_LEVELS: Session_Level[] = [
  'day_open',
  'day_high',
  'day_low',
  'prev_day_high',
  'prev_day_low',
  'prev_day_close',
  'week_open',
  'week_high',
  'week_low',
  'prev_week_high',
  'prev_week_low',
  'range_high',
  'range_low',
];
export const isRangeLevel = (level: Session_Level) => level === 'range_high' || level === 'range_low';

// O perfil de volume por sessão: as opções do indicador da trading-chart
export const PROFILE_SESSIONS: Profile_Session[] = ['each', 'all', 'pre', 'regular', 'post', 'overnight', 'custom'];
export const PROFILE_EXCHANGES: Profile_Exchange[] = [
  '',
  'NYSE',
  'CME',
  'B3',
  'EURONEXT',
  'XETRA',
  'LSE',
  'TSE',
  'HKEX',
  'FOREX',
  'CRYPTO',
];
export const PROFILE_ROWS_LAYOUTS: Profile_Rows_Layout[] = ['rows', 'ticks'];
export const PROFILE_VOLUMES: Profile_Volume[] = ['updown', 'total', 'delta'];
export const PROFILE_LEVELS: Profile_Level[] = ['poc', 'vah', 'val', 'delta', 'rowVolume'];
// Os níveis são preços; o delta (−100 a 100) e o volume da linha (0 a 100) não
export const isProfilePrice = (level: Profile_Level) => level === 'poc' || level === 'vah' || level === 'val';
// As partes do dia de cada bolsa (as da biblioteca); "A do mercado" é a de cripto, só o mercado 24h
const PROFILE_EXCHANGE_PARTS: Record<Profile_Exchange, Profile_Session[]> = {
  '': ['regular'],
  CRYPTO: ['regular'],
  NYSE: ['overnight', 'pre', 'regular', 'post'],
  CME: ['overnight', 'regular', 'post'],
  B3: ['pre', 'regular', 'post'],
  EURONEXT: ['pre', 'regular', 'post'],
  XETRA: ['pre', 'regular', 'post'],
  LSE: ['pre', 'regular', 'post'],
  TSE: ['regular'],
  HKEX: ['pre', 'regular', 'post'],
  FOREX: ['regular'],
};
/** Se a sessão escolhida existe nessa bolsa (só uma parte que ela não tem nunca dá perfis). */
export const profileSessionExists = (session: Profile_Session, exchange: Profile_Exchange) =>
  !['pre', 'post', 'overnight'].includes(session) || PROFILE_EXCHANGE_PARTS[exchange].includes(session);

// As sessões acabadas que se oferecem na lista (o backend aceita até 20)
export const SESSIONS_BACK_SHOWN = 10;
export const MAX_PROFILE_ROWS = 2000;
// '0930-1600' ou '0900-1130,1230-1530', com horas que existem (24:00 só no fim)
export const validSessionRanges = (text: string) =>
  /^\d{2}:?\d{2}-\d{2}:?\d{2}(,\d{2}:?\d{2}-\d{2}:?\d{2})*$/.test(text) &&
  text.split(',').every((part) => {
    const [a, b] = part.replace(/:/g, '').split('-');
    const minutes = (hhmm: string) =>
      Number(hhmm.slice(2)) < 60 ? Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(2)) : NaN;
    return minutes(a) <= 1439 && minutes(b) <= 1440;
  });

// Os nomes das entradas, saídas e indicadores (o backend aceita até 40)
export const MAX_NAME = 40;
export const MAX_INDICATORS = 20;

// "Há N velas" que se oferecem na lista (o backend aceita até 500)
export const CANDLES_BACK_SHOWN = 20;

// O que se lê de uma vela: os campos dela e a abertura da vela que está a começar
export type Candle_Source = Price_Field | 'open_current';
export const CANDLE_SOURCES: Candle_Source[] = ['open_current', 'open', 'high', 'low', 'close', 'volume'];

// Um valor de uma condição ou um preço de entrada/saída. Guarda todos os
// campos, para mudar de tipo e voltar sem perder o que lá estava; no pedido só
// vão os do tipo escolhido. 'market' só existe nos preços (a abertura da vela)
export type Value_Kind = 'candle' | 'indicator' | 'window' | 'session' | 'number' | 'market';

export interface Value_Form {
  kind: Value_Kind;
  source: Candle_Source;
  indicatorId: string;
  // 0 = última fechada, 1 = há 1 vela, …
  back: number;
  // '' = o tempo gráfico da simulação (só nos valores de vela; o indicador traz o seu)
  timeframe: Timeframe | '';
  value: string;
  // Num RSI com média: a linha do RSI ou a da média dele
  line: Value_Line;
  // Nas últimas N velas: qual e quantas (a máxima/mínima é do `source`)
  windowKind: Window_Kind;
  period: string;
  // Num nível do dia: qual e, na faixa de abertura, a hora local de início e os minutos
  level: Session_Level;
  rangeStart: string;
  rangeMinutes: string;
  // Num perfil de volume: o nível e de que sessão (a em curso, uma acabada — 1 = a
  // anterior — ou o nível virgem)
  profileLevel: Profile_Level;
  profileSource: Profile_Source;
  sessionsBack: string;
}

/** Um valor que não é um preço: uma contagem de velas (de 0 a N). */
export const isCountValue = (form: Value_Form) => form.kind === 'window' && isCountKind(form.windowKind);

/**
 * Um valor que não é um preço e se compara com números: o RSI, uma contagem de
 * velas, o delta e o volume da linha do perfil de volume.
 */
export const isNonPriceValue = (form: Value_Form, indicators: Indicator_Form[]) => {
  if (isCountValue(form)) return true;
  if (form.kind !== 'indicator') return false;
  const indicator = indicators.find((item) => item.id === form.indicatorId);
  if (!indicator) return false;
  if (indicator.kind === 'svp') return !isProfilePrice(form.profileLevel);
  return !isPriceIndicator(indicator.kind);
};

export type Value_Line = 'value' | 'average';

// Os que se leem das simulações gravadas (as antigas podem ter qualquer um)
export const INDICATOR_KINDS: Indicator_Kind[] = ['sma', 'ema', 'wma', 'rsi', 'svp'];
// Os que se podem escolher numa simulação nova (a ponderada fica só nas antigas; o
// perfil de volume também, porque ainda é cedo para ele: as simulações que o têm
// abrem e desenham-se, mas para simular outra vez muda-se, e o backend recusa-o)
export const SIMULATION_INDICATOR_KINDS: Indicator_Kind[] = ['sma', 'ema', 'rsi'];
export const isSimulationKind = (kind: Indicator_Kind) => SIMULATION_INDICATOR_KINDS.includes(kind);
// O RSI vai de 0 a 100: compara-se, mas não é um preço de entrada ou saída (no
// perfil de volume depende do nível: isNonPriceValue)
export const isPriceIndicator = (kind: Indicator_Kind) => kind !== 'rsi';
// O perfil de volume não tem período, fonte, deslocamento nem tempo gráfico (faz-se
// nas velas da simulação, as que o gráfico desenha)
export const isProfile = (kind: Indicator_Kind) => kind === 'svp';
// O deslocamento é das médias; a média (uma segunda linha), do RSI
export const hasShift = (kind: Indicator_Kind) => kind !== 'rsi' && kind !== 'svp';
export const hasSmoothing = (kind: Indicator_Kind) => kind === 'rsi';
export const SMOOTHING_KINDS: Smoothing_Kind[] = ['sma', 'ema'];
export const MAX_SHIFT = 100;
const isIndicatorKind = (kind: string): kind is Indicator_Kind => (INDICATOR_KINDS as string[]).includes(kind);

// Velas de que um indicador precisa (o mesmo que o indicatorBars do backend)
const indicatorBars = (kind: Indicator_Kind, period: number) => {
  if (kind === 'ema') return period * 5;
  if (kind === 'rsi') return period * 10;
  return period - 1;
};

export interface Indicator_Form {
  id: string;
  name: string;
  kind: Indicator_Kind;
  period: string;
  field: Price_Field;
  timeframe: Timeframe | '';
  // Nas médias: velas para a direita (como no TradingView); '0' = nenhum
  shift: string;
  // No RSI: a média dele ('' = nenhuma) e o período
  smoothing: Smoothing_Kind | '';
  smoothingPeriod: string;
  // No perfil de volume: as opções do indicador (o volume só muda o desenho)
  session: Profile_Session;
  customSession: string;
  exchange: Profile_Exchange;
  rowsLayout: Profile_Rows_Layout;
  rowSize: string;
  volume: Profile_Volume;
  vaPct: string;
}

// O deslocamento que conta (o RSI não o tem)
const shiftOf = (indicator: Indicator_Form) => (hasShift(indicator.kind) ? toNumber(indicator.shift || '0') : 0);
// A média do RSI, se a tiver
const smoothingOf = (indicator: Indicator_Form) =>
  hasSmoothing(indicator.kind) && indicator.smoothing
    ? { kind: indicator.smoothing, period: toNumber(indicator.smoothingPeriod) }
    : null;

export interface Condition_Form {
  id: number;
  left: Value_Form;
  operator: Operator;
  right: Value_Form;
  // Em "entre": o outro limite (fica guardado nos outros operadores, mas não vai no pedido)
  rightTo: Value_Form;
  // O lado direito ± uma % ('' = nada)
  rightPct: string;
  // Agora ('') ou nalguma/em todas as últimas N velas
  withinMode: Within_Mode | '';
  withinBars: string;
  // Um grupo: as condições dele (sem outros grupos) e como se juntam; null = uma condição.
  // Num grupo os lados ficam guardados, mas não vão no pedido
  group: Condition_Form[] | null;
  groupMatch: Condition_Match;
}

// As condições soltas, com as dos grupos (para ver valores e indicadores)
export const flatConditions = (conditions: Condition_Form[]): Condition_Form[] =>
  conditions.flatMap((condition) => (condition.group ? condition.group : [condition]));

// Os valores que uma condição usa: o rightTo só em "entre"
export const conditionValues = (condition: Condition_Form): Value_Form[] =>
  condition.group
    ? condition.group.flatMap(conditionValues)
    : isBetween(condition.operator)
      ? [condition.left, condition.right, condition.rightTo]
      : [condition.left, condition.right];

// Uma saída parcial: fecha closePct% da quantidade inicial a uma % ou a N R a favor
export interface Partial_Form {
  id: number;
  name: string;
  closePct: string;
  mode: Take_Mode;
  value: string;
  // Depois dela o stop passa para o preço de entrada
  moveStop: boolean;
}

// A preparação: primeiro estas condições (ficam armadas `bars` velas), depois as
// da entrada; as de cancelar (vazias = nenhuma) desarmam antes
export interface Setup_Form {
  conditions: Condition_Form[];
  match: Condition_Match;
  bars: string;
  cancel: Condition_Form[];
  cancelMatch: Condition_Match;
}

// Um ajuste do stop: a partir de quando e para onde (o stop só aperta)
export interface Stop_Rule_Form {
  id: number;
  trigger: Stop_Rule_Trigger;
  // Em "a favor": em R ou em %
  profitMode: Take_Mode;
  profitValue: string;
  conditions: Condition_Form[];
  match: Condition_Match;
  to: Stop_Rule_Target;
  bars: string;
  level: Value_Form;
  trailPct: string;
  bufferPct: string;
}

// Um reforço: junta sizePct% da quantidade inicial a X R ou X % a favor, ou com condições
export interface Scale_In_Form {
  id: number;
  name: string;
  trigger: Scale_In_Trigger;
  profitMode: Take_Mode;
  profitValue: string;
  conditions: Condition_Form[];
  match: Condition_Match;
  sizePct: string;
  moveStop: boolean;
}

// Uma condição da conta ("só entra se")
export interface Context_Form {
  id: number;
  kind: Context_Kind;
  scope: Context_Scope;
  operator: Context_Operator;
  value: string;
  result: Trade_Result;
}

// Uma saída: quando as condições se cumprem (todas; sem nenhuma, sempre), sai
// ao preço escolhido
export interface Exit_Form {
  id: number;
  name: string;
  conditions: Condition_Form[];
  match: Condition_Match;
  price: Value_Form;
  // Só vale nestes dias e horas (ou exceto neles); null = sempre
  schedule: Schedule_Form | null;
}

// Uma entrada da estratégia: quando entra, a que preço e as suas saídas
export interface Entry_Form {
  id: number;
  name: string;
  side: Side;
  conditions: Condition_Form[];
  // Todas as condições (E) ou qualquer uma (OU)
  match: Condition_Match;
  // Primeiro a preparação, depois as condições (null = sem ela) e "só entra se" (a conta)
  setup: Setup_Form | null;
  context: Context_Form[];
  price: Value_Form;
  // O stop: a % (stopLossPct), a mínima/máxima das últimas N velas ou um nível, com a folga
  stopMode: Stop_Mode;
  stopLossPct: string;
  stopBars: string;
  stopLevel: Value_Form;
  stopBufferPct: string;
  stopLossName: string;
  // O take profit em % (takeProfitPct) ou em R (takeR)
  takeMode: Take_Mode;
  takeProfitPct: string;
  takeR: string;
  takeProfitName: string;
  partials: Partial_Form[];
  // O stop a mexer-se por regras e os reforços
  stopRules: Stop_Rule_Form[];
  scaleIns: Scale_In_Form[];
  exits: Exit_Form[];
  // Num preço a um nível: velas que a ordem espera, se o nível acompanha, se cai sem a condição
  orderBars: string;
  orderTrack: boolean;
  orderCancel: boolean;
  // Pirâmide (com várias posições ligadas): posições desta entrada ao mesmo tempo
  maxPositions: string;
  // Com quanto entra: o capital todo, uma %, um valor ou o risco até ao stop (o valor
  // é uma % em percent e risk) e, nos futuros, a alavancagem
  sizingMode: Sizing_Mode;
  sizingValue: string;
  leverage: string;
  // Quando entra, e quando valem o stop e o take profit (null = sempre)
  schedule: Schedule_Form | null;
  stopSchedule: Schedule_Form | null;
  takeSchedule: Schedule_Form | null;
  // Trailing stop e break-even em %, saída por tempo em velas ('' = sem)
  trailingPct: string;
  breakEvenPct: string;
  maxBars: string;
}

export interface Simulation_Form_State {
  instrument: Market_Instrument | null;
  timeframe: Timeframe;
  from: string;
  to: string;
  initialCapital: string;
  // A % da comissão; em 'custom' é a de entrada e a de saída vem em feeExitPct
  feePct: string;
  feeMode: Fee_Mode;
  feeExitPct: string;
  compounding: boolean;
  options: Options_Form;
  indicators: Indicator_Form[];
  entries: Entry_Form[];
}

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

const DAY_MS = 24 * 60 * 60 * 1000;
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

const toNumber = (text: string) => Number(text.replace(',', '.'));
const optionalNumber = (text: string) => (text.trim() === '' ? null : toNumber(text));
const optionalName = (text: string) => text.trim() || null;

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

const entryPayload = (
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

// --- de uma simulação gravada para o formulário -----------------------------

const optionalText = (number: number | null | undefined) => (number == null ? '' : String(number));

// O nível virgem pode vir de longe: o aquecimento leva estes dias (o mesmo que o backend)
const PROFILE_NAKED_DAYS = 30;

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
