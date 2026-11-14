import {
  Instrument,
  Prisma,
  SimulationRun,
  SimulationTrade,
} from 'src/generated/prisma/client/client';
import { ReportBlock } from '../dto/find-report-query.dto';

export interface CreateSimulationInput {
  userId: string;
  instrumentId: string;
  timeframe: string;
  fromDate: Date;
  toDate: Date;
  strategy: Prisma.InputJsonValue;
  // O download das velas, que começa antes por causa do aquecimento
  dataFromDate: Date;
  monthsTotal: number;
  // 3.7: a simulação de onde veio (a mesma estratégia noutro mercado)
  sourceRunId?: string;
}

// A simulação sem os blocos do relatório (pedem-se à parte, findReport)
export type SimulationRunView = Omit<SimulationRun, ReportBlock> & {
  instrument: Pick<
    Instrument,
    'id' | 'source' | 'type' | 'symbol' | 'quote'
  > & {
    asset: { ticker: string | null };
  };
  download: {
    // onde começam as velas: o aquecimento dos indicadores, antes do período
    fromDate: Date;
    status: string;
    monthsDone: number;
    monthsTotal: number;
    currentMonth: Date | null;
    error: string | null;
  };
};

// Uma linha da lista de simulações: sem a estratégia, que pode ser grande
export type SimulationRunListItem = Pick<
  SimulationRun,
  | 'id'
  | 'timeframe'
  | 'fromDate'
  | 'toDate'
  | 'status'
  | 'progress'
  | 'result'
  | 'error'
  | 'createdAt'
  | 'finishedAt'
  | 'sourceRunId'
> & {
  instrument: Pick<Instrument, 'source' | 'type' | 'symbol' | 'quote'> & {
    asset: { ticker: string | null };
  };
  download: { status: string; monthsDone: number; monthsTotal: number };
};

export type TradeFilter = {
  entryRule?: number;
  exitReason?: string;
  exitRule?: number;
};

// Um trade como o gráfico o desenha
export type ChartTrade = Pick<
  SimulationTrade,
  | 'index'
  | 'entryRule'
  | 'side'
  | 'entryTime'
  | 'entryPrice'
  | 'exitTime'
  | 'exitPrice'
  | 'exitReason'
  | 'exitRule'
  | 'quantity'
  | 'pnlPct'
>;

export interface SimulationRepository {
  findInstrumentById(id: string): Promise<Instrument | null>;
  findInstrumentsByIds(ids: string[]): Promise<Instrument[]>;
  createRun(data: CreateSimulationInput): Promise<SimulationRunView>;
  findRun(id: string, userId: string): Promise<SimulationRunView | null>;
  findRuns(
    userId: string,
    skip: number,
    take: number,
  ): Promise<{ items: SimulationRunListItem[]; total: number }>;
  // 3.7: a original e as corridas noutros mercados, com o veredicto de cada uma
  findMarketRuns(
    sourceRunId: string,
    userId: string,
  ): Promise<
    (SimulationRunListItem & Pick<SimulationRun, 'instrumentId' | 'verdicts'>)[]
  >;
  findTrades(
    runId: string,
    skip: number,
    take: number,
    filter: TradeFilter,
    order?: 'asc' | 'desc',
  ): Promise<{ items: SimulationTrade[]; total: number }>;
  findChartTrades(runId: string): Promise<ChartTrade[]>;
  findReport(
    id: string,
    userId: string,
    blocks: ReportBlock[],
  ): Promise<Partial<SimulationRun> | null>;
  findRunStatus(
    id: string,
    userId: string,
  ): Promise<Pick<SimulationRun, 'id' | 'status'> | null>;
  cancelQueuedRun(id: string): Promise<boolean>;
  cancelRunningRun(id: string): Promise<boolean>;
  countActiveRuns(userId: string): Promise<number>;
  findRunsToDelete(
    ids: string[],
    userId: string,
  ): Promise<Pick<SimulationRun, 'id' | 'status' | 'downloadId'>[]>;
  deleteRuns(ids: string[], downloadIds: string[]): Promise<number>;
  notify(channel: string, id: string): Promise<void>;
}
