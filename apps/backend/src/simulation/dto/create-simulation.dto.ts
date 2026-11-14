import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const SIDES = ['long', 'short'] as const;
export const MAX_NAME = 40;
// O que se lê de cada vela (e de que se pode fazer a média)
export const PRICE_FIELDS = ['open', 'high', 'low', 'close', 'volume'] as const;
// Os indicadores das simulações novas: a média simples e a exponencial (são
// preços) e o RSI (de 0 a 100, só para comparar). As antigas podem ter a
// ponderada (o resultado fica gravado)
export const INDICATOR_KINDS = ['sma', 'ema', 'rsi'] as const;
export type Indicator_Kind = (typeof INDICATOR_KINDS)[number];
// Os valores das últimas N velas: a máxima e a mínima delas (de um campo) e
// quantas fecharam a subir (verdes) ou a descer (vermelhas); estas duas não são preços
export const WINDOW_KINDS = [
  'highest',
  'lowest',
  'bullish',
  'bearish',
] as const;
export const COUNT_KINDS = ['bullish', 'bearish'] as const;
// Os níveis do dia e da semana na hora local da estratégia (`session`)
export const SESSION_LEVELS = [
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
] as const;
export const isRangeLevel = (level?: string) => !!level?.startsWith('range_');
// O perfil de volume por sessão (o "SVP HD" da trading-chart), com as mesmas
// opções do indicador: as sessões, a bolsa ('' = a do mercado), as linhas e a %
// da área de valor. Os níveis são preços; o delta e o volume da linha não
export const PROFILE_SESSIONS = [
  'each',
  'all',
  'pre',
  'regular',
  'post',
  'overnight',
  'custom',
] as const;
export const PROFILE_EXCHANGES = [
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
] as const;
export const PROFILE_ROWS_LAYOUTS = ['rows', 'ticks'] as const;
export const PROFILE_VOLUMES = ['updown', 'total', 'delta'] as const;
export const PROFILE_LEVELS = [
  'poc',
  'vah',
  'val',
  'delta',
  'rowVolume',
] as const;
export const PROFILE_PRICE_LEVELS = ['poc', 'vah', 'val'] as const;
// A sessão em curso (em desenvolvimento), uma acabada (N para trás) ou o nível
// virgem (o da última acabada em que o preço ainda não tocou)
export const PROFILE_SOURCES = ['developing', 'session', 'naked'] as const;
export const MAX_SESSIONS_BACK = 20;
export const MAX_PROFILE_ROWS = 2000;
// '0930-1600' ou '0900-1130,1230-1530' (as horas do indicador)
export const SESSION_RANGES =
  /^\d{2}:?\d{2}-\d{2}:?\d{2}(,\d{2}:?\d{2}-\d{2}:?\d{2})*$/;
export const isProfilePrice = (level?: string) =>
  (PROFILE_PRICE_LEVELS as readonly string[]).includes(level ?? '');
export const OPERAND_KINDS = [
  'price',
  ...INDICATOR_KINDS,
  ...WINDOW_KINDS,
  'session',
  'profile',
  'number',
] as const;
export const isWindow = (kind: string) =>
  (WINDOW_KINDS as readonly string[]).includes(kind);
export const isCount = (kind: string) =>
  (COUNT_KINDS as readonly string[]).includes(kind);
// Um valor que vem das velas (com campo e vela), por oposição a um número, a um
// nível do dia ou ao mercado
export const isSeries = (kind: string) =>
  kind === 'price' ||
  (INDICATOR_KINDS as readonly string[]).includes(kind) ||
  isWindow(kind);
export const isIndicator = (kind: string): kind is Indicator_Kind =>
  (INDICATOR_KINDS as readonly string[]).includes(kind);
// Os indicadores que se definem no separador: as médias, o RSI e o perfil de volume
export const INDICATOR_DEFINITION_KINDS = [...INDICATOR_KINDS, 'svp'] as const;
// Os que têm a vela (offset): os das velas e o perfil de volume
const hasOffset = (kind: string) => isSeries(kind) || kind === 'profile';
// Os que têm período: os indicadores e os das últimas N velas
const hasPeriod = (kind: string) => isIndicator(kind) || isWindow(kind);
export const MAX_INDICATORS = 20;
// A média do RSI (como no TradingView): a simples ou a exponencial dele
export const SMOOTHING_KINDS = ['sma', 'ema'] as const;
// O deslocamento de uma média, em velas para a direita (como no TradingView)
export const MAX_SHIFT = 100;
export const FEE_MODES = ['both', 'entry', 'exit', 'custom'] as const;
// De quanto em quanto tempo entra um depósito
export const DEPOSIT_PERIODS = ['month', 'quarter', 'year'] as const;
// O preço de uma ordem ao mercado: a abertura da vela, o fecho da do sinal ou
// o preço médio do primeiro minuto
export const EXECUTION_PRICES = [
  'open',
  'signal_close',
  'first_minute_avg',
] as const;
// Quanto entra em cada trade: o capital todo, uma %, um valor ou o risco até ao stop
export const SIZING_MODES = ['all', 'percent', 'amount', 'risk'] as const;
export const SIZING_ACTIONS = ['set', 'multiply', 'reset'] as const;
export const STREAKS = ['losses', 'wins'] as const;
export const MARGIN_MODES = ['isolated', 'cross'] as const;
export const FUNDING_MODES = ['none', 'historical', 'fixed'] as const;
// Com uma posição aberta e um sinal da outra direção
export const OPPOSITE_MODES = ['ignore', 'close', 'reverse', 'hedge'] as const;
export const COOLDOWN_AFTER = ['any', 'loss'] as const;
// Um horário: só nestes dias e horas, ou exceto neles
export const SCHEDULE_MODES = ['only', 'except'] as const;
// O que faz parar as entradas (regras gerais)
export const GUARD_EVENTS = [
  'stops',
  'losses',
  'lossStreak',
  'lossAmount',
  'lossPct',
] as const;
export const DURATION_UNITS = ['hours', 'days', 'weeks'] as const;
export const INCREASE_PERIODS = ['quarter', 'year'] as const;
export const MAX_POSITIONS = 20;
export const MAX_LEVERAGE = 125;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
export const OPERATORS = [
  'gt',
  'gte',
  'lt',
  'lte',
  'cross_above',
  'cross_below',
  'between',
] as const;

// Até onde se pode olhar para trás: vela -500, média de 500
export const MAX_LOOKBACK = 500;

/** A média de um indicador (do RSI): o tipo e o período dela. */
export class SmoothingDto {
  @IsIn(SMOOTHING_KINDS)
  kind: (typeof SMOOTHING_KINDS)[number];

  @IsInt()
  @Min(2)
  @Max(MAX_LOOKBACK)
  period: number;
}

/**
 * Um lado de uma condição: um preço de uma vela, um indicador (média simples,
 * exponencial, ponderada ou RSI) ou um número.
 *
 * As velas contam-se para trás a partir da atual: -1 é a vela que está a abrir
 * (só a abertura é conhecida), -2 a última fechada, e assim por diante. Noutro
 * tempo gráfico, a -1 é a vela dele que está a decorrer e a -2 a última fechada.
 */
export class OperandDto {
  @IsIn(OPERAND_KINDS)
  kind: (typeof OPERAND_KINDS)[number];

  // Preço da vela, ou o preço de que se faz a média
  @ValidateIf((operand: OperandDto) => isSeries(operand.kind))
  @IsIn(PRICE_FIELDS)
  field?: (typeof PRICE_FIELDS)[number];

  @ValidateIf((operand: OperandDto) => hasOffset(operand.kind))
  @IsInt()
  @Min(-MAX_LOOKBACK)
  @Max(-1)
  offset?: number;

  // Outro tempo gráfico (o diário numa simulação de 1 h); sem ele, o da simulação
  @IsOptional()
  @IsIn(TIMEFRAMES)
  timeframe?: Timeframe;

  // O indicador de onde veio a média (só para o formulário se reconstruir)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  indicator?: string;

  @ValidateIf((operand: OperandDto) => hasPeriod(operand.kind))
  @IsInt()
  @Min(2)
  @Max(MAX_LOOKBACK)
  period?: number;

  // A média do RSI em vez do RSI (a linha dela)
  @IsOptional()
  @ValidateNested()
  @Type(() => SmoothingDto)
  smoothing?: SmoothingDto;

  @ValidateIf((operand: OperandDto) => operand.kind === 'number')
  @IsNumber()
  value?: number;

  // Um nível do dia ou da semana; na faixa de abertura, a hora local e os minutos dela
  @ValidateIf((operand: OperandDto) => operand.kind === 'session')
  @IsIn(SESSION_LEVELS)
  level?: (typeof SESSION_LEVELS)[number];

  @ValidateIf(
    (operand: OperandDto) =>
      operand.kind === 'session' && isRangeLevel(operand.level),
  )
  @Matches(CLOCK)
  rangeStart?: string;

  @ValidateIf(
    (operand: OperandDto) =>
      operand.kind === 'session' && isRangeLevel(operand.level),
  )
  @IsInt()
  @Min(1)
  @Max(720)
  rangeMinutes?: number;

  // O perfil de volume: o nível, de que sessão e as opções do indicador
  @ValidateIf((operand: OperandDto) => operand.kind === 'profile')
  @IsIn(PROFILE_LEVELS)
  profileLevel?: (typeof PROFILE_LEVELS)[number];

  @ValidateIf((operand: OperandDto) => operand.kind === 'profile')
  @IsIn(PROFILE_SOURCES)
  profile?: (typeof PROFILE_SOURCES)[number];

  // Numa sessão acabada: 1 = a anterior, 2 = a de antes, …
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SESSIONS_BACK)
  sessionsBack?: number;

  @ValidateIf((operand: OperandDto) => operand.kind === 'profile')
  @IsIn(PROFILE_SESSIONS)
  session?: (typeof PROFILE_SESSIONS)[number];

  @IsOptional()
  @Matches(SESSION_RANGES)
  customSession?: string;

  @IsOptional()
  @IsIn(PROFILE_EXCHANGES)
  exchange?: (typeof PROFILE_EXCHANGES)[number];

  @ValidateIf((operand: OperandDto) => operand.kind === 'profile')
  @IsIn(PROFILE_ROWS_LAYOUTS)
  rowsLayout?: (typeof PROFILE_ROWS_LAYOUTS)[number];

  @ValidateIf((operand: OperandDto) => operand.kind === 'profile')
  @IsInt()
  @Min(1)
  @Max(MAX_PROFILE_ROWS)
  rowSize?: number;

  // Nos ticks por linha: o tick do preço (o do gráfico, pelas casas decimais do mercado)
  @IsOptional()
  @IsNumber()
  @Min(0.0000000001)
  tickSize?: number;

  @ValidateIf((operand: OperandDto) => operand.kind === 'profile')
  @IsNumber()
  @Min(1)
  @Max(100)
  vaPct?: number;
}

/**
 * Um indicador definido uma vez e usado pelo nome nas condições. O motor não o
 * lê: cada uso já vem como uma média com estes valores. Fica na estratégia
 * para o formulário mostrar os indicadores ao abrir a simulação.
 */
export class IndicatorDto {
  @IsString()
  @MaxLength(MAX_NAME)
  id: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  name?: string | null;

  @IsIn(INDICATOR_DEFINITION_KINDS)
  kind: (typeof INDICATOR_DEFINITION_KINDS)[number];

  // As médias e o RSI; o perfil de volume não tem período nem fonte
  @ValidateIf((indicator: IndicatorDto) => indicator.kind !== 'svp')
  @IsInt()
  @Min(2)
  @Max(MAX_LOOKBACK)
  period?: number;

  @ValidateIf((indicator: IndicatorDto) => indicator.kind !== 'svp')
  @IsIn(PRICE_FIELDS)
  field?: (typeof PRICE_FIELDS)[number];

  // O perfil de volume: as opções do indicador da trading-chart (o gráfico
  // desenha-o com elas; cada uso já as leva)
  @IsOptional()
  @IsIn(PROFILE_SESSIONS)
  session?: (typeof PROFILE_SESSIONS)[number];

  @IsOptional()
  @Matches(SESSION_RANGES)
  customSession?: string;

  @IsOptional()
  @IsIn(PROFILE_EXCHANGES)
  exchange?: (typeof PROFILE_EXCHANGES)[number];

  @IsOptional()
  @IsIn(PROFILE_ROWS_LAYOUTS)
  rowsLayout?: (typeof PROFILE_ROWS_LAYOUTS)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PROFILE_ROWS)
  rowSize?: number;

  @IsOptional()
  @IsIn(PROFILE_VOLUMES)
  volume?: (typeof PROFILE_VOLUMES)[number];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  vaPct?: number;

  @IsOptional()
  @IsIn(TIMEFRAMES)
  timeframe?: Timeframe;

  // Nas médias: quantas velas para a direita (cada uso já vem com ele no offset)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_SHIFT)
  shift?: number;

  // No RSI: a média dele, que as condições podem usar como outra linha
  @IsOptional()
  @ValidateNested()
  @Type(() => SmoothingDto)
  smoothing?: SmoothingDto | null;
}

// Como se juntam as condições: todas (E) ou qualquer uma (OU)
export const CONDITION_MATCHES = ['all', 'any'] as const;

// Uma condição ao longo do tempo: nalguma (any) ou em todas (all) as últimas N velas
export const WITHIN_MODES = ['any', 'all'] as const;
export const MAX_WITHIN = 200;

export class WithinDto {
  @IsInt()
  @Min(2)
  @Max(MAX_WITHIN)
  bars: number;

  @IsIn(WITHIN_MODES)
  mode: (typeof WITHIN_MODES)[number];
}

// Um grupo é uma condição com `conditions` (e `match`) em vez dos dois lados
export const isGroup = (condition: ConditionDto) => !!condition.conditions;

/**
 * Uma condição — [valor] comparação [valor] — ou um grupo de condições juntas
 * entre si (todas ou qualquer uma), que conta como uma só: "(A e B) ou (C e D)".
 * Num grupo não há outros grupos (o backend recusa-os) e os lados ficam vazios.
 */
export class ConditionDto {
  @ValidateIf((condition: ConditionDto) => !isGroup(condition))
  @ValidateNested()
  @Type(() => OperandDto)
  left: OperandDto;

  @ValidateIf((condition: ConditionDto) => !isGroup(condition))
  @IsIn(OPERATORS)
  operator: (typeof OPERATORS)[number];

  @ValidateIf((condition: ConditionDto) => !isGroup(condition))
  @ValidateNested()
  @Type(() => OperandDto)
  right: OperandDto;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions?: ConditionDto[];

  // Num grupo: todas (por omissão) ou qualquer uma
  @IsOptional()
  @IsIn(CONDITION_MATCHES)
  match?: (typeof CONDITION_MATCHES)[number];

  // Nalguma ou em todas as últimas N velas (a atual incluída); sem ele, só agora
  @IsOptional()
  @ValidateNested()
  @Type(() => WithinDto)
  within?: WithinDto | null;

  // Em "entre": o outro limite (o RSI entre 30 e 70); a ordem dos dois não conta
  @ValidateIf((condition: ConditionDto) => condition.operator === 'between')
  @ValidateNested()
  @Type(() => OperandDto)
  rightTo?: OperandDto;

  // O lado direito ± uma %: "fecho acima da MME50 + 1%" (−50 a 100)
  @IsOptional()
  @IsNumber()
  @Min(-50)
  @Max(100)
  rightPct?: number | null;
}

// Preço de saída: a abertura da vela (ao mercado) ou um nível — o preço de
// uma vela, uma média ou um valor fixo
export const EXIT_PRICE_KINDS = ['market', ...OPERAND_KINDS] as const;

export class ExitPriceDto {
  @IsIn(EXIT_PRICE_KINDS)
  kind: (typeof EXIT_PRICE_KINDS)[number];

  @ValidateIf((price: ExitPriceDto) => isSeries(price.kind))
  @IsIn(PRICE_FIELDS)
  field?: (typeof PRICE_FIELDS)[number];

  @ValidateIf((price: ExitPriceDto) => hasOffset(price.kind))
  @IsInt()
  @Min(-MAX_LOOKBACK)
  @Max(-1)
  offset?: number;

  // Outro tempo gráfico (o diário numa simulação de 1 h); sem ele, o da simulação
  @IsOptional()
  @IsIn(TIMEFRAMES)
  timeframe?: Timeframe;

  // O indicador de onde veio a média (só para o formulário se reconstruir)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  indicator?: string;

  @ValidateIf((price: ExitPriceDto) => hasPeriod(price.kind))
  @IsInt()
  @Min(2)
  @Max(MAX_LOOKBACK)
  period?: number;

  @ValidateIf((price: ExitPriceDto) => price.kind === 'number')
  @IsNumber()
  @Min(0)
  value?: number;

  @ValidateIf((price: ExitPriceDto) => price.kind === 'session')
  @IsIn(SESSION_LEVELS)
  level?: (typeof SESSION_LEVELS)[number];

  @ValidateIf(
    (price: ExitPriceDto) =>
      price.kind === 'session' && isRangeLevel(price.level),
  )
  @Matches(CLOCK)
  rangeStart?: string;

  @ValidateIf(
    (price: ExitPriceDto) =>
      price.kind === 'session' && isRangeLevel(price.level),
  )
  @IsInt()
  @Min(1)
  @Max(720)
  rangeMinutes?: number;

  // O perfil de volume: o nível, de que sessão e as opções do indicador
  @ValidateIf((price: ExitPriceDto) => price.kind === 'profile')
  @IsIn(PROFILE_LEVELS)
  profileLevel?: (typeof PROFILE_LEVELS)[number];

  @ValidateIf((price: ExitPriceDto) => price.kind === 'profile')
  @IsIn(PROFILE_SOURCES)
  profile?: (typeof PROFILE_SOURCES)[number];

  // Numa sessão acabada: 1 = a anterior, 2 = a de antes, …
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SESSIONS_BACK)
  sessionsBack?: number;

  @ValidateIf((price: ExitPriceDto) => price.kind === 'profile')
  @IsIn(PROFILE_SESSIONS)
  session?: (typeof PROFILE_SESSIONS)[number];

  @IsOptional()
  @Matches(SESSION_RANGES)
  customSession?: string;

  @IsOptional()
  @IsIn(PROFILE_EXCHANGES)
  exchange?: (typeof PROFILE_EXCHANGES)[number];

  @ValidateIf((price: ExitPriceDto) => price.kind === 'profile')
  @IsIn(PROFILE_ROWS_LAYOUTS)
  rowsLayout?: (typeof PROFILE_ROWS_LAYOUTS)[number];

  @ValidateIf((price: ExitPriceDto) => price.kind === 'profile')
  @IsInt()
  @Min(1)
  @Max(MAX_PROFILE_ROWS)
  rowSize?: number;

  // Nos ticks por linha: o tick do preço (o do gráfico, pelas casas decimais do mercado)
  @IsOptional()
  @IsNumber()
  @Min(0.0000000001)
  tickSize?: number;

  @ValidateIf((price: ExitPriceDto) => price.kind === 'profile')
  @IsNumber()
  @Min(1)
  @Max(100)
  vaPct?: number;
}

// O stop: a % do preço de entrada, a mínima (numa compra) ou a máxima (numa venda)
// das últimas N velas fechadas, ou um nível (o preço de uma vela, uma média, um valor)
export const STOP_MODES = ['pct', 'swing', 'level'] as const;
export const MAX_PARTIALS = 3;

/**
 * Uma saída parcial: fecha esta % da quantidade inicial quando o preço anda a
 * favor uma % ou um múltiplo do risco (R, a distância ao stop). Pode passar o
 * stop para o preço de entrada. O resto segue com as outras saídas.
 */
export class PartialExitDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  name?: string | null;

  @IsNumber()
  @Min(1)
  @Max(99)
  closePct: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1000)
  pct?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(50)
  r?: number | null;

  @IsOptional()
  @IsBoolean()
  moveStop?: boolean;
}

// Ajustes do stop, reforços e condições da conta (até quantos de cada)
export const MAX_STOP_RULES = 5;
export const MAX_SCALE_INS = 3;
export const MAX_CONTEXT_RULES = 5;
export const STOP_RULE_TRIGGERS = ['always', 'profit', 'conditions'] as const;
export const STOP_RULE_TARGETS = ['entry', 'swing', 'level', 'trail'] as const;
export const SCALE_IN_TRIGGERS = ['profit', 'conditions'] as const;
export const CONTEXT_KINDS = [
  'lastTrade',
  'winStreak',
  'lossStreak',
  'openPositions',
  'tradesToday',
  'dayPnlPct',
  'drawdownPct',
] as const;
export const CONTEXT_SCOPES = ['all', 'self'] as const;
export const CONTEXT_OPERATORS = ['gt', 'gte', 'lt', 'lte', 'eq'] as const;
export const TRADE_RESULTS = ['win', 'loss'] as const;

/**
 * A preparação de uma entrada: primeiro estas condições (ficam armadas `bars`
 * velas), depois as da entrada. Pode cair antes, se as de cancelar se cumprirem.
 */
export class SetupDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions: ConditionDto[];

  @IsOptional()
  @IsIn(CONDITION_MATCHES)
  match?: (typeof CONDITION_MATCHES)[number];

  @IsInt()
  @Min(1)
  @Max(MAX_LOOKBACK)
  bars: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  cancel?: ConditionDto[] | null;

  @IsOptional()
  @IsIn(CONDITION_MATCHES)
  cancelMatch?: (typeof CONDITION_MATCHES)[number];
}

/**
 * Um ajuste do stop: a partir de quando acontece (sempre, depois de X R ou X % a
 * favor, ou quando as condições se cumprem), o stop passa para a entrada, para a
 * mínima/máxima das últimas N velas, para um nível ou para um trailing em %. O
 * stop só aperta.
 */
export class StopRuleDto {
  @IsIn(STOP_RULE_TRIGGERS)
  trigger: (typeof STOP_RULE_TRIGGERS)[number];

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(50)
  r?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1000)
  pct?: number | null;

  @ValidateIf((rule: StopRuleDto) => rule.trigger === 'conditions')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions?: ConditionDto[];

  @IsOptional()
  @IsIn(CONDITION_MATCHES)
  match?: (typeof CONDITION_MATCHES)[number];

  @IsIn(STOP_RULE_TARGETS)
  to: (typeof STOP_RULE_TARGETS)[number];

  @ValidateIf((rule: StopRuleDto) => rule.to === 'swing')
  @IsInt()
  @Min(1)
  @Max(MAX_LOOKBACK)
  bars?: number;

  @ValidateIf((rule: StopRuleDto) => rule.to === 'level')
  @ValidateNested()
  @Type(() => ExitPriceDto)
  level?: ExitPriceDto;

  @ValidateIf((rule: StopRuleDto) => rule.to === 'trail')
  @IsNumber()
  @Min(0.01)
  @Max(99)
  trailPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  bufferPct?: number | null;
}

/**
 * Um reforço: junta esta % da quantidade inicial quando o preço anda X R ou X %
 * a favor, ou na primeira vela depois da entrada em que as condições se cumprem.
 * Pode passar o stop para o preço de entrada.
 */
export class ScaleInDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  name?: string | null;

  @IsIn(SCALE_IN_TRIGGERS)
  trigger: (typeof SCALE_IN_TRIGGERS)[number];

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(50)
  r?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1000)
  pct?: number | null;

  @ValidateIf((add: ScaleInDto) => add.trigger === 'conditions')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions?: ConditionDto[];

  @IsOptional()
  @IsIn(CONDITION_MATCHES)
  match?: (typeof CONDITION_MATCHES)[number];

  @IsNumber()
  @Min(1)
  @Max(500)
  sizePct: number;

  @IsOptional()
  @IsBoolean()
  moveStop?: boolean;
}

/**
 * Uma condição da conta ("só entra se"): o último trade foi um ganho ou uma
 * perda, as séries, as posições abertas e os trades de hoje (de todas as
 * entradas ou só desta), o P&L de hoje e a distância ao máximo do capital, em %.
 */
export class ContextRuleDto {
  @IsIn(CONTEXT_KINDS)
  kind: (typeof CONTEXT_KINDS)[number];

  @IsOptional()
  @IsIn(CONTEXT_SCOPES)
  scope?: (typeof CONTEXT_SCOPES)[number];

  @ValidateIf((rule: ContextRuleDto) => rule.kind === 'lastTrade')
  @IsIn(TRADE_RESULTS)
  result?: (typeof TRADE_RESULTS)[number];

  @ValidateIf((rule: ContextRuleDto) => rule.kind !== 'lastTrade')
  @IsIn(CONTEXT_OPERATORS)
  operator?: (typeof CONTEXT_OPERATORS)[number];

  @ValidateIf((rule: ContextRuleDto) => rule.kind !== 'lastTrade')
  @IsNumber()
  @Min(-1000)
  @Max(1000)
  value?: number;
}

/** Quanto entra em cada trade. Em percent e risk o valor é uma %. */
export class SizingDto {
  @IsIn(SIZING_MODES)
  mode: (typeof SIZING_MODES)[number];

  @ValidateIf((sizing: SizingDto) => sizing.mode !== 'all')
  @IsNumber()
  @Min(0.01)
  @Max(1_000_000_000)
  value?: number;
}

/** Dias (0 = segunda) e horas; sem dias, todos; sem horas, o dia todo. */
export class BlockedTimeDto {
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  days: number[];

  @IsOptional()
  @Matches(CLOCK)
  from?: string | null;

  @IsOptional()
  @Matches(CLOCK)
  to?: string | null;
}

/** Quando uma entrada, um stop ou uma saída valem: só nestes dias e horas, ou exceto neles. */
export class ScheduleDto {
  @IsIn(SCHEDULE_MODES)
  mode: (typeof SCHEDULE_MODES)[number];

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => BlockedTimeDto)
  rules: BlockedTimeDto[];
}

/**
 * Uma saída de uma entrada: quando as condições se cumprem (todas; sem
 * nenhuma, sempre), sai ao preço indicado.
 */
export class ExitRuleDto {
  // Um nome para os resumos ("entrou por X, saiu por Y"); sem nome, o número
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  name?: string | null;

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions: ConditionDto[];

  // Todas (por omissão) ou qualquer uma
  @IsOptional()
  @IsIn(CONDITION_MATCHES)
  match?: (typeof CONDITION_MATCHES)[number];

  @ValidateNested()
  @Type(() => ExitPriceDto)
  price: ExitPriceDto;

  // Só vale nestes dias e horas (ou exceto neles)
  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleDto)
  schedule?: ScheduleDto;
}

/**
 * Uma entrada da estratégia: a direção, as condições (todas têm de se
 * cumprir), o preço a que entra (sem preço, ao mercado) e as suas saídas:
 * stop, take profit e saídas com condição (basta uma, ganha a que acontecer
 * primeiro).
 */
export class EntryRuleDto {
  // Um nome para os resumos ("entrou por X, saiu por Y"); sem nome, o número
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  name?: string | null;

  @IsIn(SIDES)
  side: (typeof SIDES)[number];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions: ConditionDto[];

  // Todas (por omissão) ou qualquer uma
  @IsOptional()
  @IsIn(CONDITION_MATCHES)
  match?: (typeof CONDITION_MATCHES)[number];

  // Primeiro a preparação, depois as condições
  @IsOptional()
  @ValidateNested()
  @Type(() => SetupDto)
  setup?: SetupDto | null;

  // Só entra se (a conta: o último trade, as séries, as posições…)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CONTEXT_RULES)
  @ValidateNested({ each: true })
  @Type(() => ContextRuleDto)
  context?: ContextRuleDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ExitPriceDto)
  price?: ExitPriceDto;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(99)
  stopLossPct?: number | null;

  // Sem modo, a % (stopLossPct)
  @IsOptional()
  @IsIn(STOP_MODES)
  stopLossMode?: (typeof STOP_MODES)[number];

  @ValidateIf((entry: EntryRuleDto) => entry.stopLossMode === 'swing')
  @IsInt()
  @Min(1)
  @Max(MAX_LOOKBACK)
  stopLossBars?: number | null;

  @ValidateIf((entry: EntryRuleDto) => entry.stopLossMode === 'level')
  @ValidateNested()
  @Type(() => ExitPriceDto)
  stopLossLevel?: ExitPriceDto | null;

  // Na mínima, máxima ou nível: o stop fica esta % para lá dele
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  stopLossBufferPct?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  stopLossName?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1000)
  takeProfitPct?: number | null;

  // O take profit num múltiplo do risco (2 = duas vezes a distância ao stop)
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(50)
  takeProfitR?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PARTIALS)
  @ValidateNested({ each: true })
  @Type(() => PartialExitDto)
  partialExits?: PartialExitDto[];

  // O stop a mexer-se por regras (só aperta)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_STOP_RULES)
  @ValidateNested({ each: true })
  @Type(() => StopRuleDto)
  stopRules?: StopRuleDto[];

  // Juntar à posição aberta
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SCALE_INS)
  @ValidateNested({ each: true })
  @Type(() => ScaleInDto)
  scaleIns?: ScaleInDto[];

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  takeProfitName?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ExitRuleDto)
  exits?: ExitRuleDto[];

  // Num preço a um nível: quantas velas a ordem fica à espera (1 = só a do sinal)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_LOOKBACK)
  orderBars?: number;

  // O nível acompanha o de cada vela (senão fica o do sinal)
  @IsOptional()
  @IsBoolean()
  orderTrack?: boolean;

  // A ordem cai se a condição deixar de se cumprir
  @IsOptional()
  @IsBoolean()
  orderCancel?: boolean;

  // Pirâmide: quantas posições desta entrada ao mesmo tempo
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_POSITIONS)
  maxPositions?: number;

  // O tamanho e a alavancagem desta entrada (sem eles, os gerais)
  @IsOptional()
  @ValidateNested()
  @Type(() => SizingDto)
  sizing?: SizingDto;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(MAX_LEVERAGE)
  leverage?: number;

  // Dias e horas em que entra (only) ou não entra (except)
  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleDto)
  schedule?: ScheduleDto;

  // Quando valem o stop e o take profit
  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleDto)
  stopLossSchedule?: ScheduleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleDto)
  takeProfitSchedule?: ScheduleDto;

  // O stop acompanha o melhor preço desde a entrada, a esta %
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(99)
  trailingStopPct?: number | null;

  // Depois de andar esta % a favor, o stop passa ao preço de entrada
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1000)
  breakEvenPct?: number | null;

  // Sai ao mercado ao fim de N velas
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  maxBars?: number | null;
}

/**
 * Muda o tamanho depois de N perdas (ou ganhos) seguidos: passa a um valor,
 * multiplica-se ou volta ao normal, durante as X entradas seguintes (0 = até
 * outra regra).
 */
export class SizingRuleDto {
  @IsIn(STREAKS)
  after: (typeof STREAKS)[number];

  @IsInt()
  @Min(1)
  @Max(50)
  count: number;

  @IsIn(SIZING_ACTIONS)
  action: (typeof SIZING_ACTIONS)[number];

  @ValidateIf((rule: SizingRuleDto) => rule.action !== 'reset')
  @IsNumber()
  @Min(0.01)
  @Max(1_000_000_000)
  value?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  trades?: number;
}

export class FundingDto {
  @IsIn(FUNDING_MODES)
  mode: (typeof FUNDING_MODES)[number];

  // Em 'fixed': a taxa de cada 8 horas, em % (0,01 = a habitual da Binance)
  @ValidateIf((funding: FundingDto) => funding.mode === 'fixed')
  @IsNumber()
  @Min(-1)
  @Max(1)
  ratePct?: number;
}

export class DailyLimitsDto {
  // Perdas seguidas no dia
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxLosses?: number;

  // % do capital perdida no dia
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxLossPct?: number;
}

export class DurationDto {
  @IsNumber()
  @Min(0.01)
  @Max(10_000)
  count: number;

  @IsIn(DURATION_UNITS)
  unit: (typeof DURATION_UNITS)[number];
}

/**
 * Não operar se: N stops, N perdas, N perdas seguidas, uma perda em valor ou
 * em % dentro da janela (sem janela, desde o início); acontecendo, pausa.
 */
export class TradingGuardDto {
  @IsIn(GUARD_EVENTS)
  event: (typeof GUARD_EVENTS)[number];

  @IsNumber()
  @Min(0.01)
  @Max(1_000_000_000)
  value: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => DurationDto)
  window?: DurationDto | null;

  @ValidateNested()
  @Type(() => DurationDto)
  pause: DurationDto;
}

/** O depósito sobe este valor a cada trimestre ou ano. */
export class DepositIncreaseDto {
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  amount: number;

  @IsIn(INCREASE_PERIODS)
  every: (typeof INCREASE_PERIODS)[number];
}

// O drawdown máximo de um desafio: desde o capital inicial ou desde o máximo
export const MAX_LOSS_MODES = ['static', 'trailing'] as const;

/**
 * As regras de um desafio de prop firm, avaliadas no relatório (não mudam os
 * trades): perda máxima num dia (sobre o capital no início dele), perda máxima
 * total (do inicial, ou do máximo a acompanhar), objetivo de lucro, mínimo de
 * dias com trades e a duração do desafio em dias.
 */
export class PropFirmDto {
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(50)
  dailyLossPct?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(90)
  maxLossPct?: number | null;

  @IsOptional()
  @IsIn(MAX_LOSS_MODES)
  maxLossMode?: (typeof MAX_LOSS_MODES)[number];

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(1000)
  profitTargetPct?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  minTradingDays?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number | null;
}

/** Dias em que não se entra (e em que as posições abertas fecham no início). */
export class ExcludedPeriodDto {
  @IsDateString({ strict: true })
  from: string;

  @IsDateString({ strict: true })
  to: string;
}

// Datas em 'YYYY-MM-DD'; o fim conta o dia inteiro. Percentagens em %, não em
// fração (stop de 2 = 2%)
export class CreateSimulationDto {
  @IsUUID()
  instrumentId: string;

  @IsIn(TIMEFRAMES)
  timeframe: Timeframe;

  @IsDateString({ strict: true })
  from: string;

  @IsDateString({ strict: true })
  to: string;

  @IsNumber()
  @Min(1)
  @Max(1_000_000_000)
  initialCapital: number;

  @IsNumber()
  @Min(0)
  @Max(5)
  feePct: number;

  // Quando se paga a comissão: nos dois lados (por omissão), só à entrada, só à
  // saída ou com uma % diferente em cada. O motor só lê as duas %
  @IsOptional()
  @IsIn(FEE_MODES)
  feeMode?: (typeof FEE_MODES)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  feeEntryPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  feeExitPct?: number;

  // % de preço pior nas ordens a mercado, no stop e nos rompimentos
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  slippagePct?: number;

  // Juros compostos (por omissão): cada trade com o capital todo. Sem eles,
  // sempre com o valor inicial
  @IsOptional()
  @IsBoolean()
  compounding?: boolean;

  // Um valor somado ao capital no início de cada mês, trimestre ou ano
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  depositAmount?: number;

  @IsOptional()
  @IsIn(DEPOSIT_PERIODS)
  depositEvery?: (typeof DEPOSIT_PERIODS)[number] | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => DepositIncreaseDto)
  depositIncrease?: DepositIncreaseDto | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => TradingGuardDto)
  tradingGuards?: TradingGuardDto[];

  @IsOptional()
  @IsIn(EXECUTION_PRICES)
  executionPrice?: (typeof EXECUTION_PRICES)[number];

  @IsOptional()
  @ValidateNested()
  @Type(() => SizingDto)
  sizing?: SizingDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => SizingRuleDto)
  sizingRules?: SizingRuleDto[];

  // Só nos futuros: o tamanho sobre a margem e, com ele, a liquidação
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(MAX_LEVERAGE)
  leverage?: number;

  @IsOptional()
  @IsIn(MARGIN_MODES)
  marginMode?: (typeof MARGIN_MODES)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  maintenanceMarginPct?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => FundingDto)
  funding?: FundingDto;

  // O passo e os mínimos de cada ordem (da corretora); 0 = sem limite
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityStep?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minNotional?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_POSITIONS)
  maxPositions?: number;

  @IsOptional()
  @IsIn(OPPOSITE_MODES)
  opposite?: (typeof OPPOSITE_MODES)[number];

  // Velas sem entrar depois de uma saída (ou só depois de uma perda)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  cooldownBars?: number;

  @IsOptional()
  @IsIn(COOLDOWN_AFTER)
  cooldownAfter?: (typeof COOLDOWN_AFTER)[number];

  @IsOptional()
  @ValidateNested()
  @Type(() => DailyLimitsDto)
  dailyLimits?: DailyLimitsDto;

  // O fuso das horas bloqueadas, dos períodos excluídos e dos dias (IANA)
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => BlockedTimeDto)
  blockedTimes?: BlockedTimeDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ExcludedPeriodDto)
  excludedPeriods?: ExcludedPeriodDto[];

  // Os trades depois desta % do período resumem-se à parte (fora da amostra)
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(90)
  outOfSamplePct?: number | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => PropFirmDto)
  propFirm?: PropFirmDto | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_INDICATORS)
  @ValidateNested({ each: true })
  @Type(() => IndicatorDto)
  indicators?: IndicatorDto[];

  // Na mesma vela, as entradas veem-se pela ordem da lista
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => EntryRuleDto)
  entries: EntryRuleDto[];
}
