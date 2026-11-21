// A estratégia e as opções de uma simulação, como vão no pedido (versão 3)

export type Timeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
// O que se lê de cada vela (e de que se pode fazer a média)
export type Price_Field = 'open' | 'high' | 'low' | 'close' | 'volume';
// Os indicadores: médias simples, exponenciais e ponderadas (são preços), o RSI
// (0 a 100) e o perfil de volume por sessão (o "SVP HD" da trading-chart)
export type Indicator_Kind = 'sma' | 'ema' | 'wma' | 'rsi' | 'svp';
// As opções do perfil de volume, as do indicador da biblioteca
export type Profile_Session = 'each' | 'all' | 'pre' | 'regular' | 'post' | 'overnight' | 'custom';
export type Profile_Exchange =
  | ''
  | 'NYSE'
  | 'CME'
  | 'B3'
  | 'EURONEXT'
  | 'XETRA'
  | 'LSE'
  | 'TSE'
  | 'HKEX'
  | 'FOREX'
  | 'CRYPTO';
export type Profile_Rows_Layout = 'rows' | 'ticks';
export type Profile_Volume = 'updown' | 'total' | 'delta';
// Os níveis (preços) e os dois que não são preços: o delta e o volume da linha do fecho
export type Profile_Level = 'poc' | 'vah' | 'val' | 'delta' | 'rowVolume';
// A sessão em curso, uma acabada (N para trás) ou o nível virgem
export type Profile_Source = 'developing' | 'session' | 'naked';
// Os valores das últimas N velas: a máxima e a mínima delas e quantas fecharam a
// subir (verdes) ou a descer (vermelhas)
export type Window_Kind = 'highest' | 'lowest' | 'bullish' | 'bearish';
// Os níveis do dia e da semana, na hora local da estratégia
export type Session_Level =
  | 'day_open'
  | 'day_high'
  | 'day_low'
  | 'prev_day_high'
  | 'prev_day_low'
  | 'prev_day_close'
  | 'week_open'
  | 'week_high'
  | 'week_low'
  | 'prev_week_high'
  | 'prev_week_low'
  | 'range_high'
  | 'range_low';
export type Operand_Kind = 'price' | Indicator_Kind | Window_Kind | 'session' | 'profile' | 'number';
// A média do RSI: a simples ou a exponencial dele
export type Smoothing_Kind = 'sma' | 'ema';
export interface Smoothing_Payload {
  kind: Smoothing_Kind;
  period: number;
}
export type Operator = 'gt' | 'gte' | 'lt' | 'lte' | 'cross_above' | 'cross_below' | 'between';
export type Side = 'long' | 'short';
// Quando se paga a comissão: nos dois lados, só à entrada, só à saída ou uma % diferente em cada
export type Fee_Mode = 'both' | 'entry' | 'exit' | 'custom';
// De quanto em quanto tempo entra um depósito
export type Deposit_Period = 'month' | 'quarter' | 'year';
// O preço de uma ordem ao mercado: a abertura da vela, o fecho da do sinal ou o médio do 1.º minuto
export type Execution_Price = 'open' | 'signal_close' | 'first_minute_avg';
// Quanto entra em cada trade: o capital todo, uma %, um valor ou o risco até ao stop
export type Sizing_Mode = 'all' | 'percent' | 'amount' | 'risk';
export type Sizing_Action = 'set' | 'multiply' | 'reset';
export type Streak = 'losses' | 'wins';
export type Margin_Mode = 'isolated' | 'cross';
export type Funding_Mode = 'none' | 'historical' | 'fixed';
// Com uma posição aberta e um sinal da outra direção
export type Opposite_Mode = 'ignore' | 'close' | 'reverse' | 'hedge';
export type Cooldown_After = 'any' | 'loss';

export interface Sizing_Payload {
  mode: Sizing_Mode;
  value?: number;
}

// Depois de N perdas (ou ganhos) seguidos: passa a um valor, multiplica ou volta ao normal, X entradas
export interface Sizing_Rule_Payload {
  after: Streak;
  count: number;
  action: Sizing_Action;
  value?: number;
  trades?: number;
}

// Dias (0 = segunda) e horas em que não se entra
export interface Blocked_Time_Payload {
  days: number[];
  from?: string | null;
  to?: string | null;
}

// Só nestes dias e horas (only) ou exceto neles (except)
export type Schedule_Mode = 'only' | 'except';
export interface Schedule_Payload {
  mode: Schedule_Mode;
  rules: Blocked_Time_Payload[];
}

// Não operar se: N stops, N perdas, N seguidas, perda em valor ou em %, numa janela; depois pausa
export type Guard_Event = 'stops' | 'losses' | 'lossStreak' | 'lossAmount' | 'lossPct';
export type Duration_Unit = 'hours' | 'days' | 'weeks';
export interface Duration_Payload {
  count: number;
  unit: Duration_Unit;
}
export interface Trading_Guard_Payload {
  event: Guard_Event;
  value: number;
  window?: Duration_Payload | null;
  pause: Duration_Payload;
}

export interface Excluded_Period_Payload {
  from: string;
  to: string;
}

// Os parâmetros da simulação além da estratégia (todos opcionais: sem eles, o normal)
export interface Simulation_Options_Payload {
  slippagePct?: number;
  compounding?: boolean;
  depositAmount?: number;
  depositEvery?: Deposit_Period | null;
  // O depósito sobe este valor a cada trimestre ou ano
  depositIncrease?: { amount: number; every: 'quarter' | 'year' } | null;
  tradingGuards?: Trading_Guard_Payload[];
  executionPrice?: Execution_Price;
  sizing?: Sizing_Payload;
  sizingRules?: Sizing_Rule_Payload[];
  leverage?: number;
  marginMode?: Margin_Mode;
  maintenanceMarginPct?: number;
  funding?: { mode: Funding_Mode; ratePct?: number };
  quantityStep?: number;
  minQuantity?: number;
  minNotional?: number;
  maxPositions?: number;
  opposite?: Opposite_Mode;
  cooldownBars?: number;
  cooldownAfter?: Cooldown_After;
  dailyLimits?: { maxLosses?: number; maxLossPct?: number };
  timezone?: string;
  blockedTimes?: Blocked_Time_Payload[];
  excludedPeriods?: Excluded_Period_Payload[];
  outOfSamplePct?: number | null;
  propFirm?: Prop_Firm_Payload | null;
}

// As regras de um desafio de prop firm, avaliadas no relatório (3.8): perda num dia,
// perda máxima (do inicial ou do máximo), objetivo, dias com trades e a duração em dias
export type Max_Loss_Mode = 'static' | 'trailing';
export interface Prop_Firm_Payload {
  dailyLossPct?: number | null;
  maxLossPct?: number | null;
  maxLossMode?: Max_Loss_Mode;
  profitTargetPct?: number | null;
  minTradingDays?: number | null;
  days?: number | null;
}

// Como vai para o backend: só os campos do tipo de cada lado
export interface Operand_Payload {
  kind: Operand_Kind;
  field?: Price_Field;
  offset?: number;
  period?: number;
  value?: number;
  // Outro tempo gráfico; sem ele, o da simulação
  timeframe?: Timeframe;
  // A média veio deste indicador (só para o formulário se reconstruir)
  indicator?: string;
  // A linha da média do RSI, em vez do RSI
  smoothing?: Smoothing_Payload;
  // Num nível do dia: qual e, na faixa de abertura, a hora local e os minutos dela
  level?: Session_Level;
  rangeStart?: string;
  rangeMinutes?: number;
  // No perfil de volume: o nível, de que sessão e as opções do indicador
  profileLevel?: Profile_Level;
  profile?: Profile_Source;
  sessionsBack?: number;
  session?: Profile_Session;
  customSession?: string;
  exchange?: Profile_Exchange;
  rowsLayout?: Profile_Rows_Layout;
  rowSize?: number;
  tickSize?: number;
  vaPct?: number;
}

// Um indicador definido uma vez e usado pelo nome nas condições; no pedido,
// cada uso vai com estes valores
export interface Indicator_Payload {
  id: string;
  name: string | null;
  kind: Indicator_Kind;
  // As médias e o RSI (o perfil de volume não os tem)
  period?: number;
  field?: Price_Field;
  timeframe?: Timeframe;
  // Nas médias: o deslocamento, em velas para a direita (cada uso já o leva no offset)
  shift?: number;
  // No RSI: a média dele, uma segunda linha para as condições
  smoothing?: Smoothing_Payload | null;
  // No perfil de volume: as opções do indicador
  session?: Profile_Session;
  customSession?: string;
  exchange?: Profile_Exchange;
  rowsLayout?: Profile_Rows_Layout;
  rowSize?: number;
  volume?: Profile_Volume;
  vaPct?: number;
}

// Como se juntam as condições: todas (E) ou qualquer uma (OU)
export type Condition_Match = 'all' | 'any';

// Uma condição ao longo do tempo: nalguma (any) ou em todas (all) as últimas N velas
export type Within_Mode = 'any' | 'all';
export interface Within_Payload {
  bars: number;
  mode: Within_Mode;
}

// Uma condição: [valor] comparação [valor]
export interface Comparison_Payload {
  left: Operand_Payload;
  operator: Operator;
  right: Operand_Payload;
  // Em "entre": o outro limite (o RSI entre 30 e 70)
  rightTo?: Operand_Payload;
  // O lado direito ± uma %: "acima da MME50 + 1%"
  rightPct?: number | null;
  within?: Within_Payload | null;
}

// Um grupo de condições juntas entre si, que conta como uma só: "(A e B) ou C"
export interface Condition_Group_Payload {
  conditions: Comparison_Payload[];
  match?: Condition_Match;
  within?: Within_Payload | null;
}

export type Condition_Payload = Comparison_Payload | Condition_Group_Payload;

export const isGroupPayload = (condition: Condition_Payload): condition is Condition_Group_Payload =>
  'conditions' in condition && Array.isArray(condition.conditions);

// O stop: a %, a mínima/máxima das últimas N velas fechadas ou um nível
export type Stop_Mode = 'pct' | 'swing' | 'level';

// Uma saída parcial: fecha closePct% da quantidade inicial a uma % ou a N R a favor
export interface Partial_Exit_Payload {
  name?: string | null;
  closePct: number;
  pct?: number | null;
  r?: number | null;
  moveStop?: boolean;
}

// A preparação de uma entrada: primeiro estas condições (ficam armadas `bars` velas),
// depois as da entrada; as de cancelar desarmam antes
export interface Setup_Payload {
  conditions: Condition_Payload[];
  match?: Condition_Match;
  bars: number;
  cancel?: Condition_Payload[] | null;
  cancelMatch?: Condition_Match;
}

// Um ajuste do stop: a partir de quando (sempre, a X R ou X % a favor, com
// condições) e para onde (a entrada, a mínima/máxima de N velas, um nível, um trailing)
export type Stop_Rule_Trigger = 'always' | 'profit' | 'conditions';
export type Stop_Rule_Target = 'entry' | 'swing' | 'level' | 'trail';
export interface Stop_Rule_Payload {
  trigger: Stop_Rule_Trigger;
  r?: number | null;
  pct?: number | null;
  conditions?: Condition_Payload[];
  match?: Condition_Match;
  to: Stop_Rule_Target;
  bars?: number | null;
  level?: Exit_Price_Payload | null;
  trailPct?: number | null;
  bufferPct?: number | null;
}

// Um reforço: junta sizePct% da quantidade inicial a X R ou X % a favor, ou com condições
export type Scale_In_Trigger = 'profit' | 'conditions';
export interface Scale_In_Payload {
  name?: string | null;
  trigger: Scale_In_Trigger;
  r?: number | null;
  pct?: number | null;
  conditions?: Condition_Payload[];
  match?: Condition_Match;
  sizePct: number;
  moveStop?: boolean;
}

// Uma condição da conta ("só entra se")
export type Context_Kind =
  | 'lastTrade'
  | 'winStreak'
  | 'lossStreak'
  | 'openPositions'
  | 'tradesToday'
  | 'dayPnlPct'
  | 'drawdownPct';
export type Context_Scope = 'all' | 'self';
export type Context_Operator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
export type Trade_Result = 'win' | 'loss';
export interface Context_Rule_Payload {
  kind: Context_Kind;
  scope?: Context_Scope;
  result?: Trade_Result;
  operator?: Context_Operator;
  value?: number;
}

// O preço de uma saída: a abertura da vela (ao mercado) ou um nível
export type Exit_Price_Kind = 'market' | Operand_Kind;

export interface Exit_Price_Payload extends Omit<Operand_Payload, 'kind'> {
  kind: Exit_Price_Kind;
}

// Uma saída: quando as condições se cumprem (todas; sem nenhuma, sempre)
export interface Exit_Payload {
  // Um nome para os resumos; sem nome, "Saída N"
  name?: string | null;
  conditions: Condition_Payload[];
  match?: Condition_Match;
  price: Exit_Price_Payload;
  // Só vale nestes dias e horas (ou exceto neles)
  schedule?: Schedule_Payload | null;
}

// Uma entrada: direção, condições (todas), stop, take profit e saídas
export interface Entry_Payload {
  // Nomes para os resumos; sem nome, "Entrada N", "Stop loss", "Take profit"
  name?: string | null;
  side: Side;
  conditions: Condition_Payload[];
  match?: Condition_Match;
  // Primeiro a preparação, depois as condições
  setup?: Setup_Payload | null;
  // Só entra se (a conta)
  context?: Context_Rule_Payload[];
  // Sem preço (simulações antigas), ao mercado
  price?: Exit_Price_Payload;
  stopLossPct: number | null;
  // Sem modo (simulações antigas), a %
  stopLossMode?: Stop_Mode;
  stopLossBars?: number | null;
  stopLossLevel?: Exit_Price_Payload | null;
  // Na mínima/máxima ou num nível: o stop fica esta % para lá dele
  stopLossBufferPct?: number | null;
  stopLossName?: string | null;
  takeProfitPct: number | null;
  // O take profit em múltiplos do risco (a distância ao stop)
  takeProfitR?: number | null;
  takeProfitName?: string | null;
  partialExits?: Partial_Exit_Payload[];
  // O stop a mexer-se por regras e os reforços
  stopRules?: Stop_Rule_Payload[];
  scaleIns?: Scale_In_Payload[];
  exits?: Exit_Payload[];
  // Num nível: quantas velas a ordem espera, se o nível acompanha e se cai sem a condição
  orderBars?: number;
  orderTrack?: boolean;
  orderCancel?: boolean;
  // Pirâmide: posições desta entrada ao mesmo tempo
  maxPositions?: number;
  // O tamanho e a alavancagem desta entrada (sem eles, os gerais)
  sizing?: Sizing_Payload | null;
  leverage?: number | null;
  // Quando entra, e quando valem o stop e o take profit
  schedule?: Schedule_Payload | null;
  stopLossSchedule?: Schedule_Payload | null;
  takeProfitSchedule?: Schedule_Payload | null;
  trailingStopPct?: number | null;
  breakEvenPct?: number | null;
  maxBars?: number | null;
}

export interface Simulation_Payload extends Simulation_Options_Payload {
  instrumentId: string;
  timeframe: Timeframe;
  from: string;
  to: string;
  initialCapital: number;
  feePct: number;
  feeMode: Fee_Mode;
  feeEntryPct: number;
  feeExitPct: number;
  indicators: Indicator_Payload[];
  entries: Entry_Payload[];
}
