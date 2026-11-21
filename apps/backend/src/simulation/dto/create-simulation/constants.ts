// As listas e os limites da estratégia (o que cada campo aceita)

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
