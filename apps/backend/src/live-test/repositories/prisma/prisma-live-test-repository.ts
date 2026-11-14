import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Live_Event_Kind } from '../../dto/find-live-events-query.dto';
import { ACTIVE_STATUSES } from '../../helpers/liveTestStatus';
import {
  CreateLiveTestInput,
  LiveTestRepository,
  LiveTestSummary,
} from '../live-test-repository';

const INSTRUMENT = {
  select: {
    id: true,
    source: true,
    type: true,
    symbol: true,
    quote: true,
    metadata: true,
    asset: { select: { ticker: true } },
  },
} as const;

// Tudo menos a memória (é só do simulador)
const TEST_SELECT = {
  id: true,
  userId: true,
  runId: true,
  instrumentId: true,
  timeframe: true,
  strategy: true,
  startAt: true,
  endAt: true,
  dataFromDate: true,
  status: true,
  state: true,
  error: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  finishedAt: true,
  instrument: INSTRUMENT,
} as const;

@Injectable()
export class PrismaLiveTestRepository implements LiveTestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findRun(runId: string, userId: string) {
    return this.prisma.simulationRun.findFirst({
      where: { id: runId, userId, status: 'done' },
      select: { id: true, instrumentId: true, timeframe: true, strategy: true },
    });
  }

  async create(data: CreateLiveTestInput) {
    return this.prisma.liveTest.create({ data, select: TEST_SELECT });
  }

  async findMany(userId: string, runId?: string, activeOnly = false) {
    // A lista não leva o estado (pode ter muitos trades); pede-se o de um
    return this.prisma.liveTest.findMany({
      where: {
        userId,
        ...(runId ? { runId } : {}),
        ...(activeOnly ? { status: { in: [...ACTIVE_STATUSES] } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: { ...TEST_SELECT, state: false },
    });
  }

  // Os números do estado lidos no Postgres, sem trazer o JSON todo (os trades
  // contam-se lá); um teste que ainda não tem estado não vem
  async findSummaries(ids: string[]) {
    if (!ids.length) return new Map<string, LiveTestSummary>();
    const rows = await this.prisma.$queryRaw<
      (Omit<LiveTestSummary, 'equity'> & {
        id: string;
        equity: number | null;
      })[]
    >`
      SELECT id,
        (state->>'price')::float8 AS price,
        (state->>'priceTime')::float8 AS "priceTime",
        (state->>'equity')::float8 AS equity,
        COALESCE((state->>'initialCapital')::float8, 0) AS "initialCapital",
        COALESCE((state->>'deposited')::float8, 0) AS deposited,
        jsonb_array_length(COALESCE(state->'trades', '[]'::jsonb))::int AS trades,
        (SELECT count(*)::int FROM jsonb_array_elements(COALESCE(state->'trades', '[]'::jsonb)) AS trade
          WHERE (trade->>'pnl')::float8 > 0) AS wins,
        jsonb_array_length(COALESCE(state->'open', '[]'::jsonb))::int AS open
      FROM "LiveTest"
      WHERE id = ANY(${ids}::text[]) AND state IS NOT NULL`;
    const summaries = new Map<string, LiveTestSummary>();
    for (const { id, equity, ...row } of rows) {
      if (equity !== null) summaries.set(id, { ...row, equity });
    }
    return summaries;
  }

  async findOne(id: string, userId: string) {
    return this.prisma.liveTest.findFirst({
      where: { id, userId },
      select: TEST_SELECT,
    });
  }

  async findEvents(
    testId: string,
    before: bigint | null,
    take: number,
    kinds: Live_Event_Kind[] | null,
  ) {
    return this.prisma.liveTestEvent.findMany({
      where: {
        testId,
        ...(before !== null ? { id: { lt: before } } : {}),
        ...(kinds?.length ? { kind: { in: kinds } } : {}),
      },
      // Os mais recentes primeiro (pela ordem em que se gravaram)
      orderBy: { id: 'desc' },
      take,
      select: { id: true, time: true, kind: true, data: true },
    });
  }

  async countActive(userId: string) {
    return this.prisma.liveTest.count({
      where: { userId, status: { in: [...ACTIVE_STATUSES] } },
    });
  }

  async setStatus(id: string, status: string) {
    await this.prisma.liveTest.update({ where: { id }, data: { status } });
  }

  async delete(id: string) {
    await this.prisma.liveTest.delete({ where: { id } });
  }

  // Acorda o simulador, que está à escuta deste canal (LISTEN)
  async notify(channel: string, payload: string) {
    await this.prisma.$executeRaw`SELECT pg_notify(${channel}, ${payload})`;
  }
}
