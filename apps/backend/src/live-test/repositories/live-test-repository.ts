import { LiveTest, Prisma } from 'src/generated/prisma/client/client';
import { Live_Event_Kind } from '../dto/find-live-events-query.dto';

export interface CreateLiveTestInput {
  userId: string;
  runId: string;
  instrumentId: string;
  timeframe: string;
  strategy: Prisma.InputJsonValue;
  startAt: Date;
  endAt: Date | null;
  dataFromDate: Date;
}

// O que a página mostra de um teste: o mercado vem com ele
export type LiveTestView = Omit<LiveTest, 'memory'> & {
  instrument: {
    id: string;
    source: string;
    type: string;
    symbol: string;
    quote: string;
    metadata: Prisma.JsonValue;
    asset: { ticker: string | null };
  };
};

// O resumo do estado de um teste, para a lista (sem os trades nem as condições)
export interface LiveTestSummary {
  price: number;
  priceTime: number | null;
  equity: number;
  initialCapital: number;
  deposited: number;
  trades: number;
  wins: number;
  open: number;
}

export interface LiveEventRow {
  id: bigint;
  time: Date;
  kind: string;
  data: Prisma.JsonValue;
}

export interface LiveTestRepository {
  findRun(
    runId: string,
    userId: string,
  ): Promise<{
    id: string;
    instrumentId: string;
    timeframe: string;
    strategy: Prisma.JsonValue;
  } | null>;
  create(data: CreateLiveTestInput): Promise<LiveTestView>;
  findMany(
    userId: string,
    runId?: string,
    activeOnly?: boolean,
  ): Promise<Omit<LiveTestView, 'state'>[]>;
  findSummaries(ids: string[]): Promise<Map<string, LiveTestSummary>>;
  findOne(id: string, userId: string): Promise<LiveTestView | null>;
  findEvents(
    testId: string,
    before: bigint | null,
    take: number,
    kinds: Live_Event_Kind[] | null,
  ): Promise<LiveEventRow[]>;
  countActive(userId: string): Promise<number>;
  setStatus(id: string, status: string): Promise<void>;
  delete(id: string): Promise<void>;
  notify(channel: string, payload: string): Promise<void>;
}
