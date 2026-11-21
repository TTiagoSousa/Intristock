import type { Context_Kind, Context_Scope, Context_Operator, Trade_Result } from './simulationStrategy';

// Ecrã 2, a Estratégia: os blocos 2.1 a 2.3 do relatório

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
