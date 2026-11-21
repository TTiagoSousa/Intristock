import type { Market_Instrument } from '../../../../Hooks/Trading/useMarketInstruments';
import type {
  Condition_Match,
  Context_Kind,
  Context_Operator,
  Context_Scope,
  Fee_Mode,
  Indicator_Kind,
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
import type { Options_Form, Schedule_Form } from './strategyOptions';

// O estado do formulário do simulador: as listas de opções, os limites e as formas de cada parte

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
export const isWindowKind = (kind: string): kind is Window_Kind => (WINDOW_KINDS as string[]).includes(kind);
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
export const isIndicatorKind = (kind: string): kind is Indicator_Kind => (INDICATOR_KINDS as string[]).includes(kind);

// Velas de que um indicador precisa (o mesmo que o indicatorBars do backend)
export const indicatorBars = (kind: Indicator_Kind, period: number) => {
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
export const shiftOf = (indicator: Indicator_Form) => (hasShift(indicator.kind) ? toNumber(indicator.shift || '0') : 0);
// A média do RSI, se a tiver
export const smoothingOf = (indicator: Indicator_Form) =>
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

export const DAY_MS = 24 * 60 * 60 * 1000;

export const toNumber = (text: string) => Number(text.replace(',', '.'));
export const optionalNumber = (text: string) => (text.trim() === '' ? null : toNumber(text));
export const optionalName = (text: string) => text.trim() || null;
