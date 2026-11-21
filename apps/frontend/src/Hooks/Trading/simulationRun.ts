import type { Instrument_Metadata, Instrument_Type } from './useMarketInstruments';
import type { Timeframe, Side, Fee_Mode, Simulation_Options_Payload, Indicator_Payload, Condition_Payload, Entry_Payload } from './simulationStrategy';

// Uma simulação (o pedido, o estado, o resultado e o progresso) e os trades dela

// `cancelling`: pediu-se para cancelar e o simulador ainda a está a parar (conta
// como a correr); `cancelled`: acabou sem resultado, como a que falhou
export type Run_Status = 'queued' | 'running' | 'cancelling' | 'done' | 'failed' | 'cancelled';

// Na fila, a correr ou a cancelar: ainda não acabou
export const isActiveStatus = (status: Run_Status) =>
  status === 'queued' || status === 'running' || status === 'cancelling';


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
