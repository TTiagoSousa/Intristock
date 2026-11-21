// Ecrã 1, o Resumo: os blocos 1.1 a 1.6 do relatório

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
