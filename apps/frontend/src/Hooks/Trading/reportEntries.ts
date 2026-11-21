import type { Profile_Session, Profile_Exchange, Profile_Rows_Layout, Operand_Payload, Stop_Rule_Trigger, Stop_Rule_Target, Scale_In_Trigger } from './simulationStrategy';
import type { Rule_Without } from './reportSetup';

// Ecrã 4, as Entradas e saídas: os blocos 4.1 a 4.10 do relatório

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
