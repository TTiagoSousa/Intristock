import type { Max_Loss_Mode, Operand_Payload } from './simulationStrategy';

// Ecrã 3, as Provas: a amostra (3.1), a robustez (3.2 a 3.7), o veredicto e o desafio de prop firm (3.8)

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
