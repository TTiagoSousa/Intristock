import { useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import type { Instrument_Metadata, Instrument_Type } from './useMarketInstruments';

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

// `cancelling`: pediu-se para cancelar e o simulador ainda a está a parar (conta
// como a correr); `cancelled`: acabou sem resultado, como a que falhou
export type Run_Status = 'queued' | 'running' | 'cancelling' | 'done' | 'failed' | 'cancelled';

// Na fila, a correr ou a cancelar: ainda não acabou
export const isActiveStatus = (status: Run_Status) =>
  status === 'queued' || status === 'running' || status === 'cancelling';

// Os blocos do relatório: cada um é uma coluna da SimulationRun, que o simulador
// grava já calculada (o ecrã só mostra). Pedem-se à parte, só os que se querem
export type Report_Block = 'summaryMetrics' | 'strategyScore' | 'equityCurve' | 'equityInBase' | 'underwater' | 'periodReturns' | 'horizonReturns' | 'dailyDistribution' | 'rollingSharpe' | 'monthlyDetail' | 'riskMetrics' | 'drawdownEpisodes' | 'riskRatios' | 'captureRatios' | 'returnsScatter' | 'dataQuality' | 'signalFunnel' | 'entryBreakdown' | 'setupFunnel' | 'contextRules' | 'orderExecution' | 'orderTypes' | 'orderVariants' | 'executionVariants' | 'sampleSplit' | 'sampleEquity' | 'entryCards' | 'entryPerformance' | 'entryEquity' | 'entryExitMatrix' | 'exitMix' | 'stopCards' | 'exitReasons' | 'stopsByMonth' | 'afterExit' | 'rDistribution' | 'maeScatter' | 'durationBuckets' | 'sizingSchemes' | 'entryKelly' | 'entryCorrelation' | 'tradeAnatomy' | 'tradePath' | 'exitEfficiency' | 'nextTrade' | 'tradeGroups' | 'stopRuleStats' | 'scaleInStats' | 'profileCards' | 'profilePosition' | 'profileDistance' | 'chartLevels' | 'hourCards' | 'hourEntries' | 'hourStops' | 'hourPnl' | 'hourTable' | 'exitHours' | 'exitHourStops' | 'exitHourWins' | 'exitHourEntries'
  | 'weekdayCards' | 'weekdayEntries' | 'weekdayStops' | 'weekdayPnl' | 'weekdayTable'
  | 'weekdayEntryStops' | 'weekdayEntryWins' | 'weekdayEntryPnl'
  | 'weekdayHourTrades' | 'weekdayHourStops' | 'weekdayHourWinRate' | 'weekdayHourPnl'
  | 'calendarCards' | 'calendarDaily' | 'calendarStopDays' | 'calendarBestDays' | 'calendarMonthDay' | 'calendarWeeks'
  | 'entryHourProfiles' | 'entryHourBlocks'
  | 'positionDuration' | 'positionHours' | 'sessionMoments' | 'fundingHours' | 'durationByWeekday'
  | 'hourFilters' | 'hourFilterWorst' | 'hourFilterBest'
  | 'gapCards' | 'gapDaily' | 'passageGroups' | 'sessionRules'
  | 'worldSessions' | 'workHours' | 'sessionEdges'
  | 'monteCarloCards' | 'monteCarloFan' | 'monteCarloDrawdowns' | 'walkForwardCards' | 'walkForward'
  | 'sensitivityParams' | 'sensitivityGrid' | 'costStress' | 'regimeTable' | 'regimeGrid'
  | 'performanceCurve' | 'verdicts' | 'propChallenge' | 'propWindows';

// 1.1: os 12 cartões, num bloco (valores na moeda cotada, % de 0 a 100;
// Sharpe, Sortino, volatilidade e queda sobre o índice de performance, sem depósitos)
export interface Summary_Metrics {
  version: number;
  initialCapital: number;
  deposits: number;
  finalCapital: number;
  netProfit: number;
  netProfitPct: number | null;
  cagrPct: number | null;
  buyHoldPct: number;
  sharpe: number | null;
  sortino: number | null;
  maxDrawdownPct: number;
  calmar: number | null;
  volatilityPct: number | null;
  trades: number;
  tradesPerMonth: number | null;
  winRatePct: number | null;
  payoff: number | null;
  profitFactor: number | null;
  expectancy: number | null;
  costs: number;
  fees: number;
  slippage: number;
  funding: number;
  timeInMarketPct: number;
  maxOpenPositions: number;
  positiveDaysPct: number | null;
  positiveDays: number;
  days: number;
  fromTime: number;
  toTime: number;
}

// 1.1: a nota da estratégia (0 a 100). Cada parte é uma fração de 0 a 1 vezes o
// peso; guarda os números da fórmula (% de 0 a 100; o PSR de 0 a 1)
export type Score_Label = 'solid' | 'promising' | 'notReady';
export type Score_Part_Key = 'profitability' | 'risk' | 'outOfSample' | 'significance' | 'stability' | 'costs';

export interface Score_Part {
  key: Score_Part_Key;
  weight: number;
  fraction: number;
  points: number;
  // Rentabilidade
  sharpe?: number | null;
  cagrPct?: number | null;
  // Risco
  maxDrawdownPct?: number;
  volatilityPct?: number | null;
  // Fora da amostra (a % final do período)
  outOfSamplePct?: number;
  returnPct?: number | null;
  profitFactorIn?: number | null;
  profitFactorOut?: number | null;
  tradesIn?: number;
  tradesOut?: number;
  // Significância
  trades?: number;
  psr?: number | null;
  // Estabilidade
  r2?: number | null;
  // Custos
  costs?: number;
  grossProfit?: number;
  costsPct?: number | null;
}

export interface Strategy_Score {
  version: number;
  value: number;
  label: Score_Label;
  parts: Score_Part[];
  // As escalas das fórmulas (o que vale a parte toda ou 0)
  scales: {
    sharpeFull: number;
    cagrFullPct: number;
    drawdownZeroPct: number;
    volatilityZeroPct: number;
    tradesFull: number;
    costsZeroPct: number;
  };
}

// 1.2: um ponto por dia (e o início) [tempo ms, capital, comprar e manter, drawdown %]:
// os valores na moeda cotada, com os depósitos; o drawdown da estratégia (0 ou negativo),
// sem depósitos. Os finais e a maior queda (positiva)
export interface Chart_Equity_Curve {
  version: number;
  columns: string[];
  points: [number, number, number, number][];
  finalEquity: number;
  finalBuyHold: number;
  maxDrawdownPct: number;
}

// As posições das colunas dos pontos da 1.2
export const EQUITY_CURVE = { time: 0, equity: 1, buyHold: 2, drawdownPct: 3 } as const;

// 1.2: o capital medido no ativo, um ponto por dia (e o início) [tempo ms, quantidade]:
// o capital (com os depósitos) dividido pelo preço. A quantidade do início e a do fim
export interface Chart_Equity_In_Base {
  version: number;
  columns: string[];
  points: [number, number][];
  initialQuantity: number;
  finalQuantity: number;
}

// 1.2: a distância ao máximo anterior do índice de performance (sem depósitos), um ponto
// por dia [tempo ms, drawdown %] (0 ou negativo). A maior queda (positiva) e o período mais
// longo abaixo do máximo, em dias
export interface Chart_Underwater {
  version: number;
  columns: string[];
  points: [number, number][];
  maxDrawdownPct: number;
  longestDays: number;
}

// 1.3: o retorno em % de um período (índice de performance, sem depósitos); `partial` se a
// simulação só apanha um bocado dele (o primeiro e o último)
export interface Period_Return {
  pct: number;
  partial: boolean;
}

// 1.3: a tabela dos retornos por mês, trimestre e ano (UTC), e o do período todo
export interface Table_Period_Returns {
  version: number;
  months: (Period_Return & { year: number; month: number })[];
  quarters: (Period_Return & { year: number; quarter: number })[];
  years: (Period_Return & { year: number })[];
  totalPct: number;
}

// 1.3: um horizonte — os últimos N meses (1m, 3m, 6m, 1y, 3y, 5y) ou o período todo (all)
export type Horizon_Key = '1m' | '3m' | '6m' | '1y' | '3y' | '5y' | 'all';

// 1.3: no intervalo, a estratégia (índice de performance) e o comprar e manter em %, a
// diferença em pontos percentuais, a maior queda da estratégia (positiva) e os trades fechados
export interface Horizon_Return {
  key: Horizon_Key;
  months: number | null;
  fromTime: number;
  toTime: number;
  days: number;
  strategyPct: number;
  buyHoldPct: number;
  differencePp: number;
  maxDrawdownPct: number;
  trades: number;
}

export interface Table_Horizon_Returns {
  version: number;
  rows: Horizon_Return[];
}

// 1.3: o histograma dos retornos diários (índice de performance, sem depósitos): cada barra
// [de %, até %, dias reais, dias de uma normal com a mesma média e desvio], de −rangePct a
// +rangePct (os dias de fora, `outsideDays`, contam nas barras das pontas)
export interface Chart_Daily_Distribution {
  version: number;
  columns: string[];
  bins: [number, number, number, number][];
  rangePct: number;
  days: number;
  meanPct: number;
  stdPct: number;
  outsideDays: number;
}

// As posições das colunas das barras da distribuição
export const DAILY_DISTRIBUTION = { fromPct: 0, toPct: 1, days: 2, normalDays: 3 } as const;

// 1.3: o Sharpe dos últimos `windowDays` dias em cada dia [tempo ms, Sharpe ou null sem
// oscilação na janela], o mínimo e o máximo
export interface Chart_Rolling_Sharpe {
  version: number;
  windowDays: number;
  columns: string[];
  points: [number, number | null][];
  min: number | null;
  max: number | null;
}

// 1.3: um mês da tabela mês a mês (UTC). Os trades fechados nele; o P&L bruto antes de
// comissões e funding; as comissões (negativas) e o funding (negativo = pago); o retorno e
// a maior queda (positiva) no índice de performance; o capital no fim, com os depósitos
export interface Monthly_Detail_Row {
  year: number;
  month: number;
  partial: boolean;
  trades: number;
  winRatePct: number | null;
  stops: number;
  takes: number;
  grossPnl: number;
  fees: number;
  funding: number;
  netPnl: number;
  returnPct: number;
  maxDrawdownPct: number;
  endCapital: number;
}

export interface Table_Monthly_Detail {
  version: number;
  rows: Monthly_Detail_Row[];
}

// 1.4: os 10 cartões de risco, nos retornos diários do índice de performance (em %, menos
// skewness, kurtosis, tail ratio e o número de episódios de drawdown); null sem dias
export interface Risk_Metrics {
  version: number;
  days: number;
  var95Pct: number | null;
  cvar95Pct: number | null;
  var99Pct: number | null;
  skewness: number | null;
  kurtosis: number | null;
  ulcerIndexPct: number | null;
  painIndexPct: number | null;
  tailRatio: number | null;
  worstDayPct: number | null;
  bestDayPct: number | null;
  drawdowns: number;
}

// 1.4: um episódio abaixo do pico (índice de performance): o início (o dia do máximo), o
// fundo, a recuperação (null = em curso), a profundidade em % (negativa) e os dias
export interface Drawdown_Episode {
  startTime: number;
  troughTime: number;
  recoveryTime: number | null;
  depthPct: number;
  daysToTrough: number;
  recoveryDays: number | null;
  totalDays: number;
}

// 1.4: todos os episódios, do mais fundo para o menos fundo
export interface Table_Drawdown_Episodes {
  version: number;
  episodes: Drawdown_Episode[];
}

// 1.5: um rácio ajustado ao risco
export type Ratio_Key = 'sharpe' | 'sortino' | 'calmar' | 'omega' | 'gainToPain' | 'profitFactor' | 'sqn' | 'kelly';

// 1.5: a leitura de um rácio pelos níveis do simulador (o Kelly só diz se há edge)
export type Ratio_Rating = 'weak' | 'good' | 'veryGood' | 'excellent' | 'noEdge';

// 1.5: o valor da estratégia, o do buy & hold (Sharpe, Sortino e Calmar; null nos outros)
// e a leitura. O Kelly vem em %
export interface Risk_Ratio {
  key: Ratio_Key;
  value: number | null;
  buyHold: number | null;
  rating: Ratio_Rating | null;
}

// 1.5: os rácios, os níveis de cada leitura e quantos trades conta o SQN no máximo
export interface Table_Risk_Ratios {
  version: number;
  rows: Risk_Ratio[];
  levels: Partial<Record<Ratio_Key, { good?: number; veryGood?: number; excellent?: number }>>;
  sqnMaxTrades: number;
}

// 1.6: a estratégia face ao ativo da simulação, nos retornos diários (null sem dados)
export interface Capture_Ratios {
  version: number;
  upCapturePct: number | null;
  downCapturePct: number | null;
  beta: number | null;
  alphaPct: number | null;
  correlation: number | null;
  battingAveragePct: number | null;
  days: number;
}

// 1.6: um ponto por dia [retorno do ativo %, retorno da estratégia %, início do dia UTC ms]
// e a reta dos mínimos quadrados (estratégia = interceptPct + beta × ativo). rangePct é o
// maior retorno em módulo, para os dois eixos ficarem simétricos
export interface Chart_Returns_Scatter {
  version: number;
  points: [number, number, number][];
  beta: number | null;
  interceptPct: number | null;
  rangePct: number;
}

// 2.1: as velas que a corrida usou (as do tempo gráfico; os minutos em falta à parte)
export interface Data_Quality {
  version: number;
  simulatedBars: number;
  warmupBars: number;
  warmupFromTime: number | null;
  missingBars: number;
  missingMinutes: number;
  gapThresholdPct: number;
  openingGaps: number;
  averageRangePct: number | null;
  maxRangePct: number | null;
  maxRangeTime: number | null;
  startPrice: number | null;
  endPrice: number | null;
  volatilityPct: number | null;
}

// 2.2: do sinal ao trade. Cada sinal conta uma vez, no primeiro motivo que o parou
export interface Signal_Funnel {
  version: number;
  simulatedBars: number;
  signals: number;
  blockedSchedule: number;
  blockedCooldown: number;
  blockedPyramid: number;
  blockedMaxPositions: number;
  blockedOpposite: number;
  blockedDaily: number;
  blockedGuards: number;
  noCapital: number;
  ordersPlaced: number;
  ordersExpired: number;
  rejectedMinimum: number;
  // O stop (na mínima/máxima ou num nível) do lado errado do preço; nas antigas não há
  invalidStop?: number;
  // As condições da conta («só entra se») não deixaram
  blockedContext?: number;
  trades: number;
  winningTrades: number;
}

// 2.2: por entrada (rule 1, 2…): sinais, trades, % executados, win rate, P&L e expectancy em R
export interface Entry_Breakdown_Row {
  rule: number;
  signals: number;
  trades: number;
  executedPct: number | null;
  winRatePct: number | null;
  pnl: number;
  expectancyR: number | null;
}

export interface Entry_Breakdown {
  version: number;
  entries: Entry_Breakdown_Row[];
}

// 2.2: a preparação de cada entrada que a tem: armou (desarmada), cumpriu-se outra vez armada,
// acabou sem sinal, cancelada, deu sinal (e a % das vezes que armou), a espera e o que veio depois
export interface Setup_Funnel_Row {
  rule: number;
  bars: number;
  arms: number;
  rearms: number;
  expired: number;
  cancelled: number;
  fired: number;
  firedPct: number | null;
  avgBarsToSignal: number | null;
  signals: number;
  trades: number;
}

export interface Setup_Funnel {
  version: number;
  available: boolean;
  entries: Setup_Funnel_Row[];
}

// 2.2 e 4.9: a estratégia corrida sem a regra (o Δ é atual − sem ela: o que a regra rende)
export interface Rule_Without {
  withoutTrades: number | null;
  withoutReturnPct: number | null;
  withoutMaxDrawdownPct: number | null;
  deltaPp: number | null;
}

// 2.2: cada condição da conta («só entra se»): os sinais que parou (na primeira que falhou)
export interface Context_Rule_Row extends Rule_Without {
  rule: number;
  index: number;
  kind: Context_Kind;
  scope: Context_Scope;
  operator: Context_Operator | null;
  value: number | null;
  result: Trade_Result | null;
  blocked: number;
  blockedPct: number | null;
}

export interface Context_Rules {
  version: number;
  available: boolean;
  rows: Context_Rule_Row[];
}

// 4.9: um grupo de trades
export interface Rule_Trade_Group {
  trades: number;
  winRatePct: number | null;
  avgR: number | null;
  avgPnl: number | null;
  pnl: number;
}

// 4.9: cada ajuste do stop: em quantos trades aconteceu antes da saída, as saídas no stop dele e
// os trades em que aconteceu contra os outros da entrada
export interface Stop_Rule_Row extends Rule_Without {
  rule: number;
  index: number;
  trigger: Stop_Rule_Trigger;
  to: Stop_Rule_Target;
  r: number | null;
  pct: number | null;
  trailPct: number | null;
  bars: number | null;
  fired: number;
  firedPct: number | null;
  exits: Rule_Trade_Group;
  whenFired: Rule_Trade_Group;
  notFired: Rule_Trade_Group;
}

export interface Stop_Rule_Stats {
  version: number;
  available: boolean;
  rows: Stop_Rule_Row[];
}

// 4.9: cada reforço: alcançados antes da saída, entrados (reduced = com menos do que o pedido),
// sem capital livre e abaixo do mínimo; os trades com ele contra os sem nenhum
export interface Scale_In_Row extends Rule_Without {
  rule: number;
  index: number;
  trigger: Scale_In_Trigger;
  r: number | null;
  pct: number | null;
  sizePct: number | null;
  moveStop: boolean;
  reached: number;
  filled: number;
  reduced: number;
  noCapital: number;
  rejectedMinimum: number;
  withAdd: Rule_Trade_Group;
  withoutAdds: Rule_Trade_Group;
}

// 4.10 O perfil de volume (o primeiro que a estratégia usa): as sessões, como abrem face à área de
// valor da anterior, os POC virgens e as entradas dentro dela
export interface Profile_Cards {
  version: number;
  available: boolean;
  indicator?: string;
  name?: string | null;
  session?: Profile_Session;
  exchange?: Profile_Exchange;
  rowsLayout?: Profile_Rows_Layout;
  rowSize?: number;
  vaPct?: number;
  sessions?: number;
  vaWidthPct?: number | null;
  openedAbove?: number;
  openedInside?: number;
  openedBelow?: number;
  openedOutsidePct?: number | null;
  returnedInsidePct?: number | null;
  reachedPocPct?: number | null;
  brokeOutPct?: number | null;
  nakedTouchedPct?: number | null;
  nakedMedianBars?: number | null;
  nakedUntouched?: number;
  tradesInsidePct?: number | null;
  trades?: number;
}

// 4.10 Os trades por onde entraram face à área de valor anterior (above, upper, lower, below) ou
// pela distância ao POC anterior ("<-2", "-2:-1", …, ">2", em %)
export interface Profile_Group_Row extends Rule_Trade_Group {
  key: string;
}

export interface Profile_Groups {
  version: number;
  available: boolean;
  rows?: Profile_Group_Row[];
}

export interface Scale_In_Stats {
  version: number;
  available: boolean;
  rows: Scale_In_Row[];
}

// Gráfico: os níveis que não são indicadores, como a estratégia os viu na abertura de cada vela,
// nos pontos em que mudam ([ms UTC, valor ou nulo]) — para desenhar em degraus
export interface Chart_Level_Series {
  operand: Operand_Payload;
  points: [number, number | null][];
}

export interface Chart_Levels {
  version: number;
  available: boolean;
  reason: 'tooMany' | null;
  series: Chart_Level_Series[];
}

// 2.3: as ordens num nível (entradas `rules`), somadas; a espera em velas até executar
export interface Order_Execution {
  version: number;
  rules: number[];
  orderBars: number[];
  placed: number;
  filled: number;
  executedPct: number | null;
  expired: number;
  cancelled: number;
  avgWaitBars: number | null;
  slippageSaved: number;
}

// 2.3: resultado por tipo de ordem (só os tipos que tiveram trades)
export interface Order_Type_Row {
  kind: 'market' | 'limit' | 'stop';
  trades: number;
  avgWaitBars: number;
  winRatePct: number;
  profitFactor: number | null;
  expectancy: number;
  slippage: number;
}

export interface Order_Types {
  version: number;
  rows: Order_Type_Row[];
}

// 2.3: uma variante da ordem de uma entrada (a primeira é a atual, sem Δ)
export interface Order_Variant {
  market: boolean;
  orderBars: number;
  orderTrack: boolean;
  orderCancel: boolean;
  current: boolean;
  trades: number;
  filled: number;
  expired: number;
  returnPct: number | null;
  deltaPp: number | null;
}

export interface Order_Variants {
  version: number;
  entries: { rule: number; variants: Order_Variant[] }[];
}

// 2.3: a estratégia com cada preço de execução das ordens a mercado (a atual primeiro, sem Δ)
export interface Execution_Variant {
  mode: 'open' | 'signal_close' | 'first_minute_avg';
  current: boolean;
  trades: number;
  winRatePct: number | null;
  profitFactor: number | null;
  returnPct: number | null;
  maxDrawdownPct: number | null;
  deltaPp: number | null;
}

export interface Execution_Variants {
  version: number;
  rows: Execution_Variant[];
}

// 3.1: dentro vs fora da amostra (a maior queda negativa; degradação = (fora − dentro) ÷ |dentro| em %)
export type Sample_Metric =
  | 'trades'
  | 'winRatePct'
  | 'profit'
  | 'annualReturnPct'
  | 'profitFactor'
  | 'maxDrawdownPct'
  | 'sharpe'
  | 'buyHoldPct'
  | 'expectancyR';

export interface Sample_Split {
  version: number;
  outOfSamplePct: number;
  configured: boolean;
  splitTime: number;
  rows: { key: Sample_Metric; inside: number | null; outside: number | null; degradationPct: number | null }[];
}

// 3.1: o capital de cada dia [time, equity] e o dia da divisão (o mesmo da sampleSplit)
export interface Sample_Equity {
  version: number;
  columns: ['time', 'equity'];
  points: [number, number][];
  outOfSamplePct: number;
  configured: boolean;
  splitTime: number;
}

// 4.x: uma coluna de saída (stop_loss:2.5, signal:1.2…): o motivo, a % ou as velas, a saída N da entrada
// (nas condições) e as entradas que saíram por ela (para o nome)
export interface Exit_Column {
  key: string;
  reason: string;
  value: number | null;
  rule: number | null;
  exit: number | null;
  // Um stop que um ajuste (stopRules) mexeu: o nº do ajuste da entrada `rule` (stop_loss@1.2)
  adjust?: number | null;
  rules: number[];
}

// 4.1: por entrada (R = múltiplos do risco inicial; dentro/fora pela entrada; sem esta = o motor sem ela)
export interface Entry_Performance_Row {
  rule: number;
  side: 'long' | 'short';
  trades: number;
  winRatePct: number | null;
  payoff: number | null;
  profitFactor: number | null;
  expectancy: number | null;
  avgR: number | null;
  pnl: number;
  profitSharePct: number | null;
  avgBars: number | null;
  stopsPct: number | null;
  insideR: number | null;
  outsideR: number | null;
  withoutReturnPct: number | null;
}

export interface Entry_Performance {
  version: number;
  currentReturnPct: number;
  splitTime: number;
  rows: Entry_Performance_Row[];
}

// 4.1: os 6 cartões
export interface Entry_Cards {
  version: number;
  best: { rule: number; pnl: number; avgR: number | null } | null;
  worst: { rule: number; pnl: number; avgR: number | null } | null;
  losing: number;
  entries: number;
  flips: number;
  longs: number;
  shorts: number;
  withoutWorst: { rule: number; returnPct: number; currentReturnPct: number } | null;
}

// 4.1: o P&L acumulado de cada entrada, [time, pnl] em cada saída
export interface Entry_Equity {
  version: number;
  columns: ['time', 'pnl'];
  series: { rule: number; total: number; points: [number, number][] }[];
}

// 4.2: cada par entrada → saída (nulo onde a entrada nunca saiu por ali)
export interface Entry_Exit_Cell {
  trades: number;
  winRatePct: number | null;
  pnl: number;
  avgPnl: number;
}

export interface Entry_Exit_Matrix {
  version: number;
  columns: Exit_Column[];
  rows: { rule: number; cells: (Entry_Exit_Cell | null)[] }[];
}

// 4.2: a % dos trades de cada entrada por saída (pelas chaves das colunas)
export interface Exit_Mix {
  version: number;
  columns: string[];
  rows: { rule: number; trades: number; pct: (number | null)[] }[];
}

// 4.3: os 8 cartões dos stops
export interface Stop_Cards {
  version: number;
  stops: number;
  stopsPct: number | null;
  stopsOfLossesPct: number | null;
  reversed: number;
  reversedPct: number | null;
  reversalHours: number;
  extraCostPct: number | null;
  barsToStop: number | null;
  maxStreak: number;
  breakEvens: number;
  takes: number;
  takesPct: number | null;
}

// 4.3: por motivo de saída (deixado na mesa = MFE médio − movimento médio, em % do preço)
export interface Exit_Reason_Row {
  key: string;
  trades: number;
  pct: number | null;
  winRatePct: number | null;
  avgPnl: number | null;
  pnl: number;
  avgBars: number | null;
  leftOnTablePct: number | null;
}

export interface Exit_Reasons {
  version: number;
  columns: Exit_Column[];
  rows: Exit_Reason_Row[];
}

// 4.3: stops por mês [início do mês, stops] e as sequências de N stops seguidos
export interface Stops_By_Month {
  version: number;
  columns: ['month', 'stops'];
  months: [number, number][];
  avgPerMonth: number | null;
  streaks: { length: number; count: number }[];
}

// 4.4: o preço N velas depois do take, do stop e do trailing
export interface After_Exit_Row {
  bars: number;
  trades: number;
  avgMovePct: number | null;
  continuedPct: number | null;
  returnedPct: number | null;
  reachedTakePct: number | null;
}

export interface After_Exit {
  version: number;
  continuedPct: number;
  tables: { kind: 'take_profit' | 'stop_loss' | 'trailing_stop'; trades: number; rows: After_Exit_Row[] }[];
}

// 4.5: o histograma do resultado em R (os trades sem stop ficam de fora)
export interface R_Distribution {
  version: number;
  binWidth: number;
  bins: { from: number; to: number; count: number }[];
  trades: number;
  withoutStop: number;
  minR?: number;
  maxR?: number;
}

// 4.5: um ponto por trade [MAE %, resultado %, ganhou 0/1]
export interface Mae_Scatter {
  version: number;
  columns: ['maePct', 'resultPct', 'won'];
  points: [number, number, number][];
  minMaePct: number;
  // Os limites do eixo do resultado (o pior e o percentil 98 com folga)
  resultMinPct: number;
  resultMaxPct: number;
}

// 4.5: duração × resultado, por intervalo de velas (toBars nulo = e mais)
export interface Duration_Bucket {
  fromBars: number;
  toBars: number | null;
  trades: number;
  winRatePct: number | null;
  expectancy: number;
  avgR: number | null;
  stopsPct: number;
  pnl: number;
}

export interface Duration_Buckets {
  version: number;
  rows: Duration_Bucket[];
}

// 4.6: os esquemas de risco por entrada, corridos no motor (Δ fora contra o primeiro)
export type Sizing_Scheme = 'equal' | 'positive' | 'proportional' | 'quarterKelly' | 'dropWorst' | 'doubleBest';

export interface Sizing_Scheme_Row {
  scheme: Sizing_Scheme;
  risks: number[];
  trades: number;
  returnPct: number;
  maxDrawdownPct: number;
  calmar: number | null;
  outReturnPct: number | null;
  outProfitFactor: number | null;
  deltaOutPp: number | null;
  // Os reforços que não couberam no capital com este esquema
  addsSkipped?: number;
}

export interface Sizing_Schemes {
  version: number;
  available: boolean;
  reason: 'noStop' | 'version' | null;
  // A estratégia tem reforços (com o risco por trade podem deixar de caber)
  scaleIns?: boolean;
  rows: Sizing_Scheme_Row[];
}

// 4.6: Kelly e tamanho sugerido, dentro da amostra (sugestão nula = desligar ou rever)
export interface Entry_Kelly_Row {
  rule: number;
  trades: number;
  winRatePct: number | null;
  payoff: number | null;
  expectancyR: number | null;
  kellyPct: number | null;
  quarterKellyPct: number | null;
  proportionalPct: number;
  suggestionPct: number | null;
}

export interface Entry_Kelly {
  version: number;
  rows: Entry_Kelly_Row[];
}

// 4.6: a correlação do P&L semanal entre entradas (nula se uma não varia)
export interface Entry_Correlation {
  version: number;
  weeks: number;
  rules: number[];
  matrix: (number | null)[][];
}

// 4.8: anatomia do trade (R = múltiplos do risco inicial; nulos sem stop / sem pirâmide)
export interface Trade_After {
  avgR: number | null;
  winRatePct: number | null;
  trades: number;
}

export interface Trade_Anatomy {
  version: number;
  mfeCapturePct: number | null;
  barsToPeak: number | null;
  avgBars: number | null;
  afterLoss: Trade_After;
  afterWin: Trade_After;
  separationBar: number | null;
  separationR: number;
  secondPosition: { avgR: number | null; trades: number; pnl: number } | null;
}

// 4.8: o caminho médio do trade em R desde a entrada, [vela, ganhos, perdidos, todos]
export interface Trade_Path {
  version: number;
  columns: ['bar', 'winners', 'losers', 'all'];
  points: [number, number | null, number | null, number][];
  separationBar: number | null;
  separationR: number;
  trades: number;
}

// 4.8: a eficiência da saída de um grupo (MFE e MAE em % do preço de entrada)
export interface Exit_Efficiency_Row {
  group: 'all' | 'winners' | 'losers' | 'entry' | 'exit';
  rule?: number;
  exit?: Exit_Column;
  trades: number;
  mfePct: number | null;
  maePct: number | null;
  capturePct: number | null;
  barsToMfe: number | null;
  barsToMae: number | null;
}

export interface Exit_Efficiency {
  version: number;
  rows: Exit_Efficiency_Row[];
}

// 4.8: o trade seguinte, depois de um ganho, de uma perda, de um stop e de dois seguidos
export interface Next_Trade_Row {
  after: 'win' | 'loss' | 'stop' | 'twoWins' | 'twoLosses';
  trades: number;
  winRatePct: number | null;
  avgR: number | null;
  pnl: number;
  repeatPct: number | null;
}

export interface Next_Trade {
  version: number;
  rows: Next_Trade_Row[];
}

// 4.8: pirâmide, tipo de ordem e ordem no dia (só os grupos com trades)
export interface Trade_Group_Row {
  group: 'pyramid1' | 'pyramid2' | 'pyramid3' | 'market' | 'limit' | 'stop' | 'firstOfDay' | 'laterInDay';
  trades: number;
  winRatePct: number | null;
  avgR: number | null;
  pnl: number;
  stopsPct: number;
  avgBars: number | null;
}

export interface Trade_Groups {
  version: number;
  rows: Trade_Group_Row[];
}

// 5.1 — Horas de entrada (na hora local da simulação, com a mudança de hora)
export interface Hour_Cards {
  version: number;
  timezone: string;
  trades: number;
  busiest: { hour: number; trades: number; pct: number | null } | null;
  mostStopsEntry: { hour: number; stops: number; trades: number } | null;
  mostStopsExit: { hour: number; stops: number } | null;
  best: { hour: number; pnl: number; winRate: number | null } | null;
  worst: { hour: number; pnl: number; stopsPct: number | null } | null;
  emptyHours: number[];
}

export interface Hour_Entries {
  version: number;
  timezone: string;
  // Os trades de cada entrada em cada hora (0 a 23)
  entries: { rule: number; counts: number[] }[];
  totals: number[];
}

export interface Hour_Stops {
  version: number;
  timezone: string;
  columns: ['hour', 'trades', 'stops', 'stopsPct'];
  hours: [number, number, number, number | null][];
}

export interface Hour_Pnl {
  version: number;
  timezone: string;
  // Abaixo destes trades a hora é amostra pequena (o ecrã esbate-a)
  minTrades?: number;
  columns: ['hour', 'trades', 'pnl', 'winRate'];
  hours: [number, number, number, number | null][];
}

export interface Hour_Table {
  version: number;
  timezone: string;
  rows: {
    hour: number;
    session: 'asia' | 'europe' | 'overlap' | 'us' | 'night';
    trades: number;
    pct: number | null;
    longs: number;
    shorts: number;
    winRatePct: number | null;
    stops: number;
    stopsPct: number | null;
    pnl: number;
    expectancy: number | null;
    avgR: number | null;
    avgBars: number | null;
    topEntry: { rule: number; trades: number } | null;
  }[];
}

// 5.2 — Horas de saída (na hora local da simulação)
export interface Exit_Hours {
  version: number;
  timezone: string;
  // Os trades fechados em cada hora (0 a 23) por motivo de saída
  reasons: { reason: string; counts: number[] }[];
  totals: number[];
}

export interface Exit_Hour_Stops {
  version: number;
  timezone: string;
  // As horas da madrugada (pouca liquidez), noutro tom
  nightHours: number[];
  columns: ['hour', 'stops'];
  hours: [number, number][];
}

export interface Exit_Hour_Wins {
  version: number;
  timezone: string;
  columns: ['hour', 'wins', 'takeProfit', 'trailingStop', 'breakEven'];
  hours: [number, number, number, number, number][];
}

export interface Exit_Hour_Entries {
  version: number;
  timezone: string;
  nightHours: number[];
  rows: {
    rule: number;
    trades: number;
    stops: number;
    topStopHours: { hour: number; stops: number }[];
    avgEntryHour: number | null;
    avgExitHour: number | null;
    topWinHour: { hour: number; trades: number } | null;
    firstHourStops: number;
    firstHourPct: number | null;
    nightStops: number;
    nightPct: number | null;
  }[];
}

// 5.3 — Dias da semana (0 = segunda, no dia local em que o trade abriu)
interface Weekday_Part {
  trades: number;
  pnl: number;
  winRatePct: number | null;
  stopsPct: number | null;
}

export interface Weekday_Cards {
  version: number;
  timezone: string;
  busiest: { day: number; trades: number; perDay: number | null } | null;
  mostStops: { day: number; stopsPct: number; stops: number } | null;
  best: { day: number; pnl: number; avgR: number | null } | null;
  worst: { day: number; pnl: number; avgR: number | null } | null;
  // Segunda a sexta e o fim de semana
  week: Weekday_Part;
  weekend: Weekday_Part;
}

export interface Weekday_Entries {
  version: number;
  timezone: string;
  entries: { rule: number; counts: number[] }[];
  totals: number[];
}

export interface Weekday_Stops {
  version: number;
  timezone: string;
  // Os stops dos trades abertos no dia e os atingidos no dia
  columns: ['day', 'entryStops', 'exitStops'];
  days: [number, number, number][];
}

export interface Weekday_Pnl {
  version: number;
  timezone: string;
  minTrades?: number;
  columns: ['day', 'trades', 'pnl', 'winRate', 'avgR'];
  days: [number, number, number, number | null, number | null][];
}

export interface Weekday_Table {
  version: number;
  timezone: string;
  rows: {
    day: number;
    // Quantos dias desse tipo tem o período
    days: number;
    trades: number;
    perDay: number | null;
    winRatePct: number | null;
    stops: number;
    stopsPct: number | null;
    exitStops: number;
    pnl: number;
    expectancy: number | null;
    avgR: number | null;
    avgBars: number | null;
    worstStreak: number;
    bestEntry: { rule: number; pnl: number } | null;
    worstEntry: { rule: number; pnl: number } | null;
  }[];
}

export interface Weekday_Entry_Counts {
  version: number;
  timezone: string;
  entries: { rule: number; counts: number[] }[];
}

export interface Weekday_Entry_Pnl {
  version: number;
  timezone: string;
  entries: { rule: number; pnl: number[] }[];
}

// 5.4: dia da semana × hora de entrada; cada quadro tem 7 linhas (0 = segunda) × 24 horas
export interface Weekday_Hour_Trades {
  version: number;
  timezone: string;
  // Abaixo destes trades a célula é amostra pequena (o ecrã esbate-a)
  minTrades?: number;
  trades: number[][];
  max: number;
}

export interface Weekday_Hour_Stops {
  version: number;
  timezone: string;
  // Nulo = sem trades
  stops: (number | null)[][];
  trades: number[][];
  max: number;
}

export interface Weekday_Hour_Win_Rate {
  version: number;
  timezone: string;
  // Os trades a partir dos quais há win rate
  minTrades: number;
  // De 0 a 100; nulo = sem trades ou menos de `minTrades`
  winRatePct: (number | null)[][];
  wins: number[][];
  trades: number[][];
}

export interface Weekday_Hour_Pnl {
  version: number;
  timezone: string;
  minTrades?: number;
  // Nulo = sem trades
  avgPnl: (number | null)[][];
  pnl: (number | null)[][];
  trades: number[][];
  // O limite da escala das cores (simétrica à volta do 0); nulo = sem trades
  scale: number | null;
}

// 5.5: o calendário, por dia local (o P&L da equity; trades e stops pelo dia em que fecharam)
export interface Calendar_Day {
  date: string;
  // 0 = segunda
  weekday: number;
  pnl: number;
  trades: number;
  stops: number;
}

export interface Calendar_Cards {
  version: number;
  timezone: string;
  days: number;
  tradeDays: number;
  tradeDaysPct: number | null;
  positiveDays: number;
  negativeDays: number;
  // Dos dias com movimento
  positivePct: number | null;
  best: Calendar_Day | null;
  worst: Calendar_Day | null;
  winStreak: number;
  lossStreak: number;
  // Dias com 2 ou mais stops
  stopDays: number;
}

export interface Calendar_Daily {
  version: number;
  timezone: string;
  columns: ['date', 'pnl', 'trades', 'stops'];
  days: [string, number, number, number][];
  // O limite da escala das cores (simétrica à volta do 0); nulo = nenhum dia com movimento
  scale: number | null;
  // Abaixo disto (em módulo) o dia conta como sem movimento
  flat: number;
}

export interface Calendar_Entry_Count {
  rule: number;
  count: number;
}

export interface Calendar_Stop_Days {
  version: number;
  timezone: string;
  rows: (Calendar_Day & { entries: Calendar_Entry_Count[] })[];
}

export interface Calendar_Best_Days {
  version: number;
  timezone: string;
  netProfit: number;
  rows: (Calendar_Day & { profitPct: number | null; entries: Calendar_Entry_Count[] })[];
}

export interface Calendar_Month_Day {
  version: number;
  timezone: string;
  // Dias 1 a 31
  pnl: number[];
  first5: number;
  last5: number;
}

export interface Calendar_Weeks {
  version: number;
  timezone: string;
  columns: ['start', 'pnl', 'stops'];
  weeks: [string, number, number][];
  positive: number;
  first: string | null;
  last: string | null;
}

// 5.6: cada entrada por hora de entrada (24 valores em cada lista)
export interface Entry_Hour_Profile {
  rule: number;
  trades: number;
  stops: number;
  wins: number[];
  stopHours: number[];
  others: number[];
  pnl: number[];
  // As horas em que o horário da entrada deixa entrar; nulo = sem horário
  band: number[] | null;
  busiest: { hour: number; trades: number } | null;
  best: { hour: number; pnl: number; winRatePct: number } | null;
  mostStops: { hour: number; stops: number; trades: number } | null;
}

export interface Entry_Hour_Profiles {
  version: number;
  timezone: string;
  entries: Entry_Hour_Profile[];
}

export interface Entry_Hour_Block_Cell {
  trades: number;
  winRatePct: number;
  pnl: number;
  expectancy: number;
}

export interface Entry_Hour_Blocks {
  version: number;
  timezone: string;
  minTrades?: number;
  blockHours: number;
  // Cada linha: uma célula por bloco (nula = sem trades) e o melhor e o pior bloco (índices)
  rows: { rule: number; cells: (Entry_Hour_Block_Cell | null)[]; best: number | null; worst: number | null }[];
  scale: number | null;
}

// 5.7: o tempo em posição
export interface Position_Duration {
  version: number;
  timezone: string;
  columns: ['hour', 'trades', 'avgBars'];
  hours: [number, number, number | null][];
}

export interface Position_Hours {
  version: number;
  timezone: string;
  // As posições abertas em média em cada hora local (pelo tempo)
  open: (number | null)[];
  nightHours: number[];
}

export interface Session_Moment {
  moment: 'dailyClose' | 'nyOpen' | 'nyClose';
  // As horas locais (HH:MM) em que o momento cai, da mais frequente
  localTimes: string[];
  count: number;
  withPosition: number;
  pct: number | null;
  trades: number;
  pnl: number;
}

export interface Session_Moments {
  version: number;
  timezone: string;
  moments: Session_Moment[];
}

export interface Funding_Hours {
  version: number;
  timezone: string;
  // Sem funding na simulação, `paid` é nulo
  funding: boolean;
  charges: { hour: number; localTimes: string[]; count: number; withPosition: number; pct: number | null; paid: number | null }[];
}

export interface Duration_By_Weekday {
  version: number;
  timezone: string;
  // Os motivos de saída das colunas, pela ordem
  reasons: string[];
  rows: { day: number; trades: number; avgBars: number | null; byExit: (number | null)[] }[];
}

// 5.8 e 5.9: uma variante corrida no motor (retornos em %, a queda negativa,
// dentro e fora da amostra divididos como na 3.1)
export interface Variant_Numbers {
  trades: number;
  stops: number;
  returnPct: number;
  maxDrawdownPct: number;
  deltaPct: number;
  inReturnPct: number | null;
  outReturnPct: number | null;
  deltaOutPct: number | null;
}

export interface Hour_Filter_Row extends Variant_Numbers {
  // 'current' é a estratégia como está
  filter: 'current' | 'worstHours' | 'stopHours' | 'worstDay' | 'bestHours' | 'worstHoursDay' | 'exitStopHour' | 'night' | 'opens' | 'weekdays';
  // As horas locais e os dias (0 = segunda) bloqueados; em 'bestHours', `keep` são as que ficam
  hours: number[];
  days: number[];
  keep: number[];
  signalsBlocked: number;
}

export interface Hour_Filters {
  version: number;
  timezone: string;
  splitTime: number;
  configured: boolean;
  rows: Hour_Filter_Row[];
}

export interface Hour_Sample_Stats {
  trades: number;
  expectancy: number | null;
  stopsPct: number | null;
  winRatePct: number | null;
}

export interface Hour_Filter_Sample {
  version: number;
  timezone: string;
  minTrades: number;
  // `holds`: a expectancy fora tem o mesmo sinal que dentro (nulo sem trades fora)
  rows: { hour: number; inside: Hour_Sample_Stats; outside: Hour_Sample_Stats; holds: boolean | null }[];
}

export interface Gap_Cards {
  version: number;
  timezone: string;
  days: number;
  mondays: number;
  meanAbsPct: number | null;
  biggest: { date: string; pct: number } | null;
  crossing: number;
  crossingPct: number | null;
  weekend: number;
  gapStops: number;
  gapCost: number;
}

export interface Gap_Daily {
  version: number;
  timezone: string;
  columns: ['date', 'pct'];
  days: [string, number][];
  meanAbsPct: number | null;
  mondayMeanAbsPct: number | null;
  maxAbsPct: number | null;
}

export interface Passage_Groups {
  version: number;
  timezone: string;
  rows: {
    group: 'sameDay' | 'daily' | 'weekend' | 'long' | 'short' | 'all';
    trades: number;
    pnl: number;
    stops: number;
    stopsPct: number | null;
    gapStops: number;
  }[];
}

export interface Session_Rules {
  version: number;
  timezone: string;
  rows: (Variant_Numbers & { rule: 'current' | 'weekendClose' | 'weekendNoEntry' | 'nyClose' | 'noMidnight' })[];
}

export interface Session_Summary {
  trades: number;
  winRatePct: number | null;
  stops: number;
  stopsPct: number | null;
  pnl: number;
  expectancy: number | null;
}

export interface World_Sessions {
  version: number;
  timezone: string;
  // As horas UTC de `from` a `to` (exclusivo); a volatilidade é a amplitude média das velas de 1 hora, em %
  rows: (Session_Summary & { session: string; from: number; to: number; volatilityPct: number | null })[];
}

export interface Work_Hours {
  version: number;
  timezone: string;
  // 'offset' é uma diferença para UTC (inverno e verão), em horas
  rows: (Session_Summary & { period: 'work' | 'evening' | 'night' | 'weekend' | 'offset'; hours: number; perHundred: number | null; offset?: number })[];
  workPnl: number;
  offPnl: number;
}

export interface Session_Edges {
  version: number;
  timezone: string;
  rows: { session: string; first: number; last: number; firstHour: Session_Summary; lastHour: Session_Summary; rest: Session_Summary }[];
}

// 3.2 a 3.6: a robustez (retornos em %, a queda negativa nas variantes e
// positiva no Monte Carlo, como a distância ao máximo)
export interface Monte_Carlo_Cards {
  version: number;
  paths: number;
  blockDays: number;
  available: boolean;
  realReturnPct?: number;
  returnP5?: number;
  returnP50?: number;
  returnP95?: number;
  realDrawdownPct?: number;
  drawdownP50?: number;
  drawdownP95?: number;
  lossPct?: number;
  realReturnRank?: number;
  realDrawdownRank?: number;
}

export interface Monte_Carlo_Fan {
  version: number;
  paths: number;
  blockDays: number;
  available: boolean;
  columns?: ['time', 'p5', 'p25', 'p50', 'p75', 'p95', 'real'];
  points?: [number, number, number, number, number, number, number][];
}

export interface Monte_Carlo_Drawdowns {
  version: number;
  paths: number;
  blockDays: number;
  available: boolean;
  // [de, até, caminhos]
  bins?: [number, number, number][];
  real?: number;
  ruin?: { level: number; pct: number }[];
}

export interface Walk_Forward_Cards {
  version: number;
  windows: number;
  available: boolean;
  positiveWindows?: number;
  beatBuyHold?: number;
  walkForwardPct?: number | null;
  fixedPct?: number | null;
  chosenPositive?: number;
  worstWindowPct?: number | null;
  // As janelas em que a variante escolhida fez melhor do que a estratégia como está
  chosenBeatFixed?: number;
}

export interface Walk_Forward_Row {
  window: number;
  from: number;
  to: number;
  returnPct: number | null;
  drawdownPct: number;
  buyHoldPct: number | null;
  trades: number;
  pnl: number;
  // As variantes: 'current' ou '<parâmetro>@<passo>' (ex.: 'ind:ind-mm50h4@0.8')
  bestKey: string | null;
  bestReturnPct: number | null;
  chosenKey: string | null;
  chosenReturnPct: number | null;
}

export interface Walk_Forward {
  version: number;
  windows: number;
  available: boolean;
  rows?: Walk_Forward_Row[];
}

// Os números de uma variante corrida no motor
export interface Robustness_Numbers {
  trades: number;
  returnPct: number;
  maxDrawdownPct: number;
  outReturnPct: number | null;
  profitFactor: number | null;
  fees: number;
}

export type Sensitivity_Kind =
  | 'indicator'
  | 'stopLossPct'
  | 'takeProfitPct'
  | 'trailingStopPct'
  | 'breakEvenPct'
  | 'stopLossBars'
  | 'takeProfitR'
  | 'setupBars'
  | 'stopRuleR'
  | 'stopRulePct'
  | 'stopRuleTrail'
  | 'stopRuleBars'
  | 'scaleInR'
  | 'scaleInPct'
  | 'scaleInSize'
  | 'window'
  // O perfil de volume: a % da área de valor e o tamanho das linhas
  | 'profileVa'
  | 'profileRows';

export interface Sensitivity_Param {
  key: string;
  kind: Sensitivity_Kind;
  // O id do indicador, o nº da entrada ou (nas últimas N velas) a chave do valor
  ref: string | number;
  // O nº do ajuste do stop ou do reforço da entrada
  index?: number | null;
  // Nas últimas N velas: o valor (kind, field, period, timeframe)
  operand?: Operand_Payload | null;
  name?: string | null;
  timeframe?: string | null;
  value: number;
}

export interface Sensitivity_Params {
  version: number;
  steps: number[];
  current: Robustness_Numbers;
  rows: (Sensitivity_Param & {
    steps: (Robustness_Numbers & { step: number; value: number })[];
    spreadPct: number;
    positivePct: number;
  })[];
  positivePct: number | null;
  outPositivePct: number | null;
  currentRank: number | null;
}

export interface Sensitivity_Grid {
  version: number;
  steps: number[];
  available?: boolean;
  x?: Sensitivity_Param;
  y?: Sensitivity_Param;
  xValues?: number[];
  yValues?: number[];
  // cells[y][x]
  cells?: Robustness_Numbers[][];
}

export interface Cost_Stress {
  version: number;
  feeEntryPct: number;
  feeExitPct: number;
  slippagePct: number;
  current: Robustness_Numbers;
  rows: (Robustness_Numbers & {
    variant: 'fee2' | 'fee3' | 'slip05' | 'slip10' | 'fee2slip05';
    feeMult: number;
    slippageAdd: number;
    deltaPct: number;
  })[];
  // × a comissão atual em que o retorno chega a 0 (nula se não chega até ×3)
  breakEvenFeeMult: number | null;
}

export interface Regime_Row {
  regime: string;
  days: number;
  daysPct: number | null;
  returnPct: number | null;
  annualPct: number | null;
  buyHoldPct: number | null;
  buyHoldAnnualPct: number | null;
  trades: number;
  winRatePct: number | null;
  pnl: number;
  expectancy: number | null;
}

export interface Regime_Table {
  version: number;
  trendDays: number;
  slopeDays: number;
  volDays: number;
  volMedianPct: number | null;
  trend: Regime_Row[];
  volatility: Regime_Row[];
}

export interface Regime_Grid {
  version: number;
  trendDays: number;
  volDays: number;
  volMedianPct: number | null;
  rows: ('bull' | 'lateral' | 'bear')[];
  columns: ('high' | 'low')[];
  cells: Regime_Row[][];
}

export interface Performance_Curve {
  version: number;
  columns: ['time', 'returnPct'];
  points: [number, number][];
}

// Um número de uma conclusão, com o que é (para o ecrã o escrever)
export interface Verdict_Value {
  kind: 'pct' | 'number' | 'money' | 'mult' | 'entry' | 'filter' | 'rule' | 'regimes' | 'text';
  value: number | string | string[] | null;
}

export type Verdict_Overall = 'robust' | 'fragile' | 'inconclusive';

export interface Verdict_Test {
  key: 'sample' | 'outOfSample' | 'monteCarlo' | 'sensitivity' | 'walkForward' | 'costs' | 'regimes' | 'concentration';
  state: 'pass' | 'fail' | 'unknown';
  values: Record<string, Verdict_Value>;
}

export interface Verdict_Finding {
  key: string;
  tone: 'positive' | 'negative' | 'neutral';
  values: Record<string, Verdict_Value>;
}

export interface Verdicts {
  version: number;
  overall: Verdict_Overall;
  passes: number;
  fails: number;
  tests: Verdict_Test[];
  screens: { entries: Verdict_Finding[]; hours: Verdict_Finding[] };
}

// O que GET /simulations/:id/report devolve: o estado e os blocos pedidos
// (null numa simulação anterior ao relatório)
export interface Simulation_Report {
  status: Run_Status;
  summaryMetrics?: Summary_Metrics | null;
  strategyScore?: Strategy_Score | null;
  equityCurve?: Chart_Equity_Curve | null;
  equityInBase?: Chart_Equity_In_Base | null;
  underwater?: Chart_Underwater | null;
  periodReturns?: Table_Period_Returns | null;
  horizonReturns?: Table_Horizon_Returns | null;
  dailyDistribution?: Chart_Daily_Distribution | null;
  rollingSharpe?: Chart_Rolling_Sharpe | null;
  monthlyDetail?: Table_Monthly_Detail | null;
  riskMetrics?: Risk_Metrics | null;
  drawdownEpisodes?: Table_Drawdown_Episodes | null;
  riskRatios?: Table_Risk_Ratios | null;
  captureRatios?: Capture_Ratios | null;
  returnsScatter?: Chart_Returns_Scatter | null;
  dataQuality?: Data_Quality | null;
  signalFunnel?: Signal_Funnel | null;
  entryBreakdown?: Entry_Breakdown | null;
  setupFunnel?: Setup_Funnel | null;
  contextRules?: Context_Rules | null;
  orderExecution?: Order_Execution | null;
  orderTypes?: Order_Types | null;
  orderVariants?: Order_Variants | null;
  executionVariants?: Execution_Variants | null;
  sampleSplit?: Sample_Split | null;
  sampleEquity?: Sample_Equity | null;
  entryCards?: Entry_Cards | null;
  entryPerformance?: Entry_Performance | null;
  entryEquity?: Entry_Equity | null;
  entryExitMatrix?: Entry_Exit_Matrix | null;
  exitMix?: Exit_Mix | null;
  stopCards?: Stop_Cards | null;
  exitReasons?: Exit_Reasons | null;
  stopsByMonth?: Stops_By_Month | null;
  afterExit?: After_Exit | null;
  rDistribution?: R_Distribution | null;
  maeScatter?: Mae_Scatter | null;
  durationBuckets?: Duration_Buckets | null;
  sizingSchemes?: Sizing_Schemes | null;
  entryKelly?: Entry_Kelly | null;
  entryCorrelation?: Entry_Correlation | null;
  tradeAnatomy?: Trade_Anatomy | null;
  tradePath?: Trade_Path | null;
  exitEfficiency?: Exit_Efficiency | null;
  nextTrade?: Next_Trade | null;
  tradeGroups?: Trade_Groups | null;
  stopRuleStats?: Stop_Rule_Stats | null;
  scaleInStats?: Scale_In_Stats | null;
  profileCards?: Profile_Cards | null;
  profilePosition?: Profile_Groups | null;
  profileDistance?: Profile_Groups | null;
  chartLevels?: Chart_Levels | null;
  hourCards?: Hour_Cards | null;
  hourEntries?: Hour_Entries | null;
  hourStops?: Hour_Stops | null;
  hourPnl?: Hour_Pnl | null;
  hourTable?: Hour_Table | null;
  exitHours?: Exit_Hours | null;
  exitHourStops?: Exit_Hour_Stops | null;
  exitHourWins?: Exit_Hour_Wins | null;
  exitHourEntries?: Exit_Hour_Entries | null;
  weekdayCards?: Weekday_Cards | null;
  weekdayEntries?: Weekday_Entries | null;
  weekdayStops?: Weekday_Stops | null;
  weekdayPnl?: Weekday_Pnl | null;
  weekdayTable?: Weekday_Table | null;
  weekdayEntryStops?: Weekday_Entry_Counts | null;
  weekdayEntryWins?: Weekday_Entry_Counts | null;
  weekdayEntryPnl?: Weekday_Entry_Pnl | null;
  weekdayHourTrades?: Weekday_Hour_Trades | null;
  weekdayHourStops?: Weekday_Hour_Stops | null;
  weekdayHourWinRate?: Weekday_Hour_Win_Rate | null;
  weekdayHourPnl?: Weekday_Hour_Pnl | null;
  calendarCards?: Calendar_Cards | null;
  calendarDaily?: Calendar_Daily | null;
  calendarStopDays?: Calendar_Stop_Days | null;
  calendarBestDays?: Calendar_Best_Days | null;
  calendarMonthDay?: Calendar_Month_Day | null;
  calendarWeeks?: Calendar_Weeks | null;
  entryHourProfiles?: Entry_Hour_Profiles | null;
  entryHourBlocks?: Entry_Hour_Blocks | null;
  positionDuration?: Position_Duration | null;
  positionHours?: Position_Hours | null;
  sessionMoments?: Session_Moments | null;
  fundingHours?: Funding_Hours | null;
  durationByWeekday?: Duration_By_Weekday | null;
  hourFilters?: Hour_Filters | null;
  hourFilterWorst?: Hour_Filter_Sample | null;
  hourFilterBest?: Hour_Filter_Sample | null;
  gapCards?: Gap_Cards | null;
  gapDaily?: Gap_Daily | null;
  passageGroups?: Passage_Groups | null;
  sessionRules?: Session_Rules | null;
  worldSessions?: World_Sessions | null;
  workHours?: Work_Hours | null;
  sessionEdges?: Session_Edges | null;
  monteCarloCards?: Monte_Carlo_Cards | null;
  monteCarloFan?: Monte_Carlo_Fan | null;
  monteCarloDrawdowns?: Monte_Carlo_Drawdowns | null;
  walkForwardCards?: Walk_Forward_Cards | null;
  walkForward?: Walk_Forward | null;
  sensitivityParams?: Sensitivity_Params | null;
  sensitivityGrid?: Sensitivity_Grid | null;
  costStress?: Cost_Stress | null;
  regimeTable?: Regime_Table | null;
  regimeGrid?: Regime_Grid | null;
  performanceCurve?: Performance_Curve | null;
  verdicts?: Verdicts | null;
  propChallenge?: Prop_Challenge | null;
  propWindows?: Prop_Windows | null;
}

// 3.8: o desafio de prop firm. passed = chegou ao objetivo antes de partir uma
// regra; failed = partiu a perda diária (daily) ou a máxima (maxLoss); open = nenhum
export type Prop_Outcome = 'passed' | 'failed' | 'open';
export type Prop_Rule = 'daily' | 'maxLoss';
export interface Prop_Result {
  outcome: Prop_Outcome;
  atMs: number | null;
  days: number | null;
  rule: Prop_Rule | null;
  tradingDays: number;
  worstDailyPct: number | null;
  maxDrawdownPct: number | null;
  finalPct: number | null;
}
export interface Prop_Challenge {
  version: number;
  available: boolean;
  rules?: {
    dailyLossPct: number | null;
    maxLossPct: number | null;
    maxLossMode: Max_Loss_Mode;
    profitTargetPct: number | null;
    minTradingDays: number;
    days: number;
  };
  deposits?: boolean;
  whole?: Prop_Result;
  windows?: {
    count: number;
    passed: number;
    failed: number;
    failedDaily: number;
    failedMaxLoss: number;
    open: number;
    passRatePct: number | null;
    medianDaysToPass: number | null;
  };
}
export interface Prop_Windows {
  version: number;
  days: number;
  windows: { startMs: number; outcome: Prop_Outcome; days: number | null; rule: Prop_Rule | null; finalPct: number | null }[];
}

export interface Simulation_Result {
  initialCapital: number;
  finalCapital: number;
  netProfit: number;
  netProfitPct: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  profitFactor: number | null;
  maxDrawdownPct: number;
  avgTradePct: number | null;
  bestTradePct: number | null;
  worstTradePct: number | null;
  totalFees: number;
  // Faltam nas simulações anteriores ao slippage e aos depósitos
  totalSlippage?: number;
  totalDeposits?: number;
  // Faltam nas anteriores às posições múltiplas, aos futuros e às amostras
  totalFunding?: number;
  skippedOrders?: number;
  maxOpenPositions?: number;
  // Na moeda do ativo (BTC num BTC/USDT)
  inBase?: { initial: number; deposits: number; final: number; netProfitPct: number };
  samples?: {
    splitPct: number;
    splitTime: number;
    inSample: Sample_Result;
    outOfSample: Sample_Result;
  };
  // signal falta nas simulações anteriores às condições de saída
  exitReasons: { stop_loss: number; take_profit: number; signal?: number; end: number } & Record<string, number>;
  // Só nas simulações com várias entradas
  longs?: number;
  shorts?: number;
  byEntry?: { rule: number; side: Side; trades: number; wins: number; pnl: number }[];
  // Cada par entrada → saída (exit: stop_loss, take_profit, signal:N ou end)
  byExit?: { rule: number; exit: string; trades: number; wins: number; pnl: number }[];
  buyHoldPct: number;
  bars: number;
  firstBarTime: number;
  lastBarTime: number;
}

// O resumo de uma parte do período (dentro ou fora da amostra)
export interface Sample_Result {
  trades: number;
  wins: number;
  winRate: number | null;
  netProfit: number;
  netProfitPct: number | null;
  profitFactor: number | null;
  maxDrawdownPct: number;
  buyHoldPct: number;
}

export interface Simulation_Run {
  id: string;
  timeframe: Timeframe;
  fromDate: string;
  toDate: string;
  // Versão 3: entries com as suas saídas. A 2 tinha stop, take profit e
  // condições de saída gerais; a 1 uma direção e condições soltas
  strategy: Simulation_Options_Payload & {
    version?: number;
    initialCapital: number;
    feePct: number;
    // Sem elas (simulações antigas), a feePct nos dois lados
    feeMode?: Fee_Mode;
    feeEntryPct?: number;
    feeExitPct?: number;
    indicators?: Indicator_Payload[];
    stopLossPct?: number | null;
    takeProfitPct?: number | null;
    entries?: Entry_Payload[];
    side?: Side;
    conditions?: Condition_Payload[];
    exitConditions?: Condition_Payload[];
  };
  status: Run_Status;
  progress: number;
  progressInfo: Run_Progress_Info | null;
  startedAt: string | null;
  result: Simulation_Result | null;
  error: string | null;
  instrument: {
    id: string;
    source: string;
    type: Instrument_Type;
    symbol: string;
    quote: string;
    metadata?: Instrument_Metadata | null;
    asset: { ticker: string | null };
  };
  download: {
    // Onde começam as velas: o aquecimento dos indicadores, antes do período
    fromDate?: string;
    status: Run_Status;
    monthsDone: number;
    monthsTotal: number;
    currentMonth: string | null;
    candles?: number;
    startedAt?: string | null;
    error: string | null;
  };
}

// Onde vai a simulação a correr (o simulador grava-o): a fase, a secção do
// relatório, as variantes, as velas, os trades e a hora prevista do fim
export type Run_Phase = 'loading' | 'simulating' | 'report' | 'saving';
export type Run_Report_Section = 'report' | 'orders' | 'entries' | 'hours' | 'schedule' | 'robustness';
export interface Run_Progress_Info {
  phase: Run_Phase;
  section?: Run_Report_Section;
  bars?: number;
  trades?: number;
  variantsDone?: number;
  variantsTotal?: number;
  // ms UTC
  estimatedEndAt?: number | null;
}

export type Exit_Reason =
  | 'stop_loss'
  | 'trailing_stop'
  | 'break_even'
  | 'take_profit'
  | 'signal'
  | 'time'
  | 'liquidation'
  | 'opposite'
  | 'excluded'
  | 'end';

export interface Simulation_Trade {
  index: number;
  entryRule: number;
  side: Side;
  entryTime: string;
  entryPrice: number;
  exitTime: string;
  exitPrice: number;
  exitReason: Exit_Reason;
  exitRule: number | null;
  quantity: number;
  pnl: number;
  pnlPct: number;
  fees: number;
  equity: number;
  // Pago (negativo = recebido), já descontado no pnl
  funding?: number;
  // 4.7: a excursão adversa e a favorável em % do preço de entrada e as velas
  // abertas (nulas nas simulações anteriores)
  maePct?: number | null;
  mfePct?: number | null;
  bars?: number | null;
  // As saídas parciais antes da final (nulo sem elas)
  partials?: { time: number; price: number; quantity: number; pnl: number }[] | null;
  // Os reforços (a quantity do trade é a inicial; n = o nº do reforço; nulo sem eles)
  adds?: { time: number; price: number; quantity: number; n?: number }[] | null;
  // Por onde andou o stop (ajustes e passagem à entrada), a começar no da entrada; nulo se não mexeu
  stopMoves?: { time: number; level: number }[] | null;
}

// Quantos por página e por que ordem (asc = pela entrada; desc = o mais recente primeiro)
export interface Trades_Options {
  pageSize?: number;
  order?: 'asc' | 'desc';
}

// O simulador grava o progresso no máximo a cada meio segundo
const POLL_MS = 1000;

export const isRunActive = (run: Simulation_Run) => isActiveStatus(run.status);

const errorMessage = (error: unknown) => {
  const message = (error as { response?: { data?: { message?: string | string[] } } }).response?.data
    ?.message;
  return Array.isArray(message) ? message.join(', ') : (message ?? null);
};

/**
 * Uma simulação, acompanhada até acabar: enquanto está na fila ou a correr,
 * volta a pedir o estado a cada segundo.
 *
 * O "a carregar" é derivado (o id pedido ainda não é o da simulação que está
 * aqui) em vez de um setState dentro do efeito.
 */
export const useSimulationRun = (runId: string | null) => {
  const [run, setRun] = useState<Simulation_Run | null>(null);
  const [missingId, setMissingId] = useState<string | null>(null);
  // Sobe quando um pedido falha a meio (o backend a reiniciar): volta a pedir
  const [retry, setRetry] = useState(0);

  const current = run && run.id === runId ? run : null;

  useEffect(() => {
    if (!runId || missingId === runId) return;
    if (current && !isRunActive(current)) return;
    let cancelled = false;

    const timer = setTimeout(
      () => {
        http
          .get(End_Points.Simulation_Endpoint(runId))
          .then((response) => {
            if (!cancelled) setRun(response.data);
          })
          .catch(() => {
            if (cancelled) return;
            // Um id antigo no URL (de outro utilizador ou apagado); a meio, tenta outra vez
            if (!current) setMissingId(runId);
            else setRetry((value) => value + 1);
          });
      },
      current ? POLL_MS : 0,
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Cada resposta nova (current) volta a agendar o pedido seguinte
  }, [runId, current, missingId, retry]);

  return {
    run: current,
    missing: Boolean(runId) && missingId === runId,
    loading: Boolean(runId) && !current && missingId !== runId,
  };
};

/**
 * Os blocos do relatório de uma simulação (GET /simulations/:id/report), só os
 * pedidos e só quando ela acabou. O "a carregar" é derivado (o que está
 * carregado é de outra simulação ou de outros blocos).
 */
export const useSimulationReport = (runId: string, blocks: Report_Block[], ready: boolean) => {
  const key = `${runId}:${blocks.join(',')}`;
  const [result, setResult] = useState<{ key: string; report: Simulation_Report | null } | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    http
      .get<Simulation_Report>(End_Points.Simulation_Report_Endpoint(runId), { params: { blocks: blocks.join(',') } })
      .then((response) => {
        if (!cancelled) setResult({ key, report: response.data });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, report: null });
      });
    return () => {
      cancelled = true;
    };
    // A chave junta a simulação e os blocos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  const current = result?.key === key ? result : null;
  return {
    report: current?.report ?? null,
    loading: ready && !current,
    failed: current !== null && current.report === null,
  };
};

export const useCreateSimulation = () => {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (payload: Simulation_Payload): Promise<Simulation_Run | null> => {
    setCreating(true);
    setError(null);
    try {
      const response = await http.post(End_Points.Simulations_Endpoint(), payload);
      return response.data;
    } catch (requestError) {
      setError(errorMessage(requestError));
      return null;
    } finally {
      setCreating(false);
    }
  };

  return { create, creating, error };
};

export const TRADES_PAGE_SIZE = 10;

// Só os trades de uma entrada e/ou de uma saída (stop_loss, take_profit, signal:N, end)
export interface Trades_Filter {
  entryRule?: number;
  exit?: string;
}

// Os trades de uma simulação acabada, dez por página
export const useSimulationTrades = (
  runId: string | null,
  page: number,
  filter: Trades_Filter = {},
  options: Trades_Options = {},
) => {
  const pageSize = options.pageSize ?? TRADES_PAGE_SIZE;
  const order = options.order ?? 'asc';
  const key = runId ? `${runId}|${page}|${filter.entryRule ?? ''}|${filter.exit ?? ''}|${pageSize}|${order}` : '';
  const [result, setResult] = useState<{ key: string; items: Simulation_Trade[]; total: number }>({
    key: '',
    items: [],
    total: 0,
  });

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;

    http
      .get(End_Points.Simulation_Trades_Endpoint(runId), {
        params: { skip: (page - 1) * pageSize, take: pageSize, order, ...filter },
      })
      .then((response) => {
        if (!cancelled) setResult({ key, ...response.data });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, items: [], total: 0 });
      });

    return () => {
      cancelled = true;
    };
    // A chave já resume o id, a página, o filtro, o tamanho e a ordem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const fresh = result.key === key;
  return {
    trades: fresh ? result.items : [],
    total: fresh ? result.total : 0,
    loading: Boolean(runId) && !fresh,
  };
};
