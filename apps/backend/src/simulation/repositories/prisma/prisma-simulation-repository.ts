import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateSimulationInput,
  SimulationRepository,
  TradeFilter,
} from '../simulation-repository';
import { REPORT_BLOCKS, ReportBlock } from '../../dto/find-report-query.dto';
import { ACTIVE_RUN_STATUSES } from '../../helpers/runStatus';

const RUN_INCLUDE = {
  instrument: {
    select: {
      id: true,
      source: true,
      type: true,
      symbol: true,
      quote: true,
      metadata: true,
      asset: { select: { ticker: true } },
    },
  },
  download: {
    select: {
      // onde começam as velas: o aquecimento dos indicadores, antes do período
      fromDate: true,
      status: true,
      monthsDone: true,
      monthsTotal: true,
      currentMonth: true,
      candles: true,
      startedAt: true,
      error: true,
    },
  },
} as const;

const RUN_LIST_SELECT = {
  id: true,
  timeframe: true,
  fromDate: true,
  toDate: true,
  status: true,
  progress: true,
  progressInfo: true,
  result: true,
  error: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
  sourceRunId: true,
  instrument: {
    select: {
      source: true,
      type: true,
      symbol: true,
      quote: true,
      asset: { select: { ticker: true } },
    },
  },
  download: {
    select: {
      status: true,
      monthsDone: true,
      monthsTotal: true,
      currentMonth: true,
      startedAt: true,
    },
  },
} as const;

// Os blocos do relatório ficam de fora da simulação: pedem-se à parte, só os
// que se querem (findReport)
const REPORT_OMIT = Object.fromEntries(
  REPORT_BLOCKS.map((block) => [block, true]),
) as Record<ReportBlock, true>;

// Só os canais que o downloader e o simulador escutam (LISTEN)
const CHANNELS = ['market_data_download', 'simulation_run'];

@Injectable()
export class PrismaSimulationRepository implements SimulationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findInstrumentById(id: string) {
    return this.prisma.instrument.findUnique({ where: { id } });
  }

  // O download e a simulação nascem juntos: uma simulação sem o seu download
  // ficava na fila para sempre
  async createRun(data: CreateSimulationInput) {
    return this.prisma.$transaction(async (tx) => {
      const download = await tx.marketDataDownload.create({
        data: {
          userId: data.userId,
          instrumentId: data.instrumentId,
          fromDate: data.dataFromDate,
          toDate: data.toDate,
          monthsTotal: data.monthsTotal,
        },
      });

      return tx.simulationRun.create({
        data: {
          userId: data.userId,
          instrumentId: data.instrumentId,
          downloadId: download.id,
          timeframe: data.timeframe,
          fromDate: data.fromDate,
          toDate: data.toDate,
          strategy: data.strategy,
          sourceRunId: data.sourceRunId ?? null,
        },
        include: RUN_INCLUDE,
        omit: REPORT_OMIT,
      });
    });
  }

  async findInstrumentsByIds(ids: string[]) {
    return this.prisma.instrument.findMany({ where: { id: { in: ids } } });
  }

  // 3.7: a original e as corridas noutros mercados, pela ordem em que se criaram
  async findMarketRuns(sourceRunId: string, userId: string) {
    return this.prisma.simulationRun.findMany({
      where: {
        userId,
        OR: [{ id: sourceRunId }, { sourceRunId }],
      },
      select: { ...RUN_LIST_SELECT, instrumentId: true, verdicts: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findRun(id: string, userId: string) {
    return this.prisma.simulationRun.findFirst({
      where: { id, userId },
      include: RUN_INCLUDE,
      omit: REPORT_OMIT,
    });
  }

  // Só os blocos pedidos, com o estado (sem relatório: a correr, ou uma
  // simulação anterior a ele)
  async findReport(id: string, userId: string, blocks: ReportBlock[]) {
    return this.prisma.simulationRun.findFirst({
      where: { id, userId },
      select: {
        status: true,
        ...Object.fromEntries(blocks.map((block) => [block, true])),
      },
    });
  }

  async findRuns(userId: string, skip: number, take: number) {
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.simulationRun.findMany({
        where,
        select: RUN_LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.simulationRun.count({ where }),
    ]);
    return { items, total };
  }

  async findTrades(
    runId: string,
    skip: number,
    take: number,
    filter: TradeFilter,
    order: 'asc' | 'desc' = 'asc',
  ) {
    const where = { runId, ...filter };
    const [items, total] = await Promise.all([
      this.prisma.simulationTrade.findMany({
        where,
        orderBy: { index: order },
        skip,
        take,
      }),
      this.prisma.simulationTrade.count({ where }),
    ]);
    return { items, total };
  }

  // Todos, para o gráfico: só o que ele desenha
  findChartTrades(runId: string) {
    return this.prisma.simulationTrade.findMany({
      where: { runId },
      orderBy: { index: 'asc' },
      select: {
        index: true,
        entryRule: true,
        side: true,
        entryTime: true,
        entryPrice: true,
        exitTime: true,
        exitPrice: true,
        exitReason: true,
        exitRule: true,
        quantity: true,
        pnlPct: true,
        partials: true,
        adds: true,
        stopMoves: true,
      },
    });
  }

  async findRunStatus(id: string, userId: string) {
    return this.prisma.simulationRun.findFirst({
      where: { id, userId },
      select: { id: true, status: true },
    });
  }

  // Na fila: cancela-se logo (só se ainda estiver na fila)
  async cancelQueuedRun(id: string) {
    const { count } = await this.prisma.simulationRun.updateMany({
      where: { id, status: 'queued' },
      data: { status: 'cancelled', finishedAt: new Date(), error: null },
    });
    return count > 0;
  }

  // A correr: o simulador vê o `cancelling`, para-a e passa-a a `cancelled`
  async cancelRunningRun(id: string) {
    const { count } = await this.prisma.simulationRun.updateMany({
      where: { id, status: 'running' },
      data: { status: 'cancelling' },
    });
    return count > 0;
  }

  // As que ocupam a fila ou o simulador (o limite por utilizador)
  async countActiveRuns(userId: string) {
    return this.prisma.simulationRun.count({
      where: { userId, status: { in: [...ACTIVE_RUN_STATUSES] } },
    });
  }

  async findRunsToDelete(ids: string[], userId: string) {
    return this.prisma.simulationRun.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true, status: true, downloadId: true },
    });
  }

  // As simulações e os pedidos de velas que ficam sem nenhuma (o que está a
  // descarregar fica: o downloader acaba o mês e grava-o para as próximas)
  async deleteRuns(ids: string[], downloadIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.simulationRun.deleteMany({
        where: { id: { in: ids } },
      });
      await tx.marketDataDownload.deleteMany({
        where: {
          id: { in: downloadIds },
          status: { not: 'running' },
          simulations: { none: {} },
        },
      });
      return count;
    });
  }

  async notify(channel: string, id: string) {
    if (!CHANNELS.includes(channel)) {
      throw new Error(`Canal desconhecido: ${channel}`);
    }
    await this.prisma.$executeRaw`SELECT pg_notify(${channel}, ${id})`;
  }
}
