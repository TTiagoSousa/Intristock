import { BadRequestException, NotFoundException } from '@nestjs/common';
import { countMonthsInRange } from 'src/market-data/helpers/countMonthsInRange';
import { Prisma } from 'src/generated/prisma/client/client';
import { PrismaSimulationRepository } from '../repositories/prisma/prisma-simulation-repository';
import { CreateMarketRunsDto } from '../dto/create-market-runs.dto';
import { earliestCandle } from './earliestCandle';
import { setProfileTicks } from './setProfileTicks';
import { assertNoProfile } from './assertNoProfile';
import { assertRunQueue } from './assertRunQueue';

// O mínimo de cada mercado (`Instrument.metadata`, da Binance), como o formulário propõe
const metadataNumber = (metadata: unknown, key: string) => {
  const value = (metadata as Record<string, unknown> | null)?.[key];
  const number = typeof value === 'string' ? Number(value) : (value as number);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

/**
 * 3.7 — Corre a estratégia de uma simulação noutros mercados: uma simulação
 * nova por mercado, com o mesmo período, tempo gráfico e estratégia (os
 * mínimos de quantidade e de valor passam a ser os do mercado novo) e o mesmo
 * aquecimento. Todas ficam ligadas à original (`sourceRunId`; a partir de uma
 * corrida noutro mercado, à mesma original). Só mercados do mesmo tipo (spot
 * com spot, futuros com futuros), porque a estratégia leva ou não alavancagem
 * e funding.
 */
export async function createMarketRuns(
  userId: string,
  id: string,
  dto: CreateMarketRunsDto,
  repository: PrismaSimulationRepository,
) {
  const run = await repository.findRun(id, userId);
  if (!run) throw new NotFoundException('Simulação não encontrada');

  const sourceRunId = run.sourceRunId ?? run.id;
  const futures = run.instrument.type !== 'spot';
  const warmupMs = run.fromDate.getTime() - run.download.fromDate.getTime();
  const strategy = run.strategy as Prisma.JsonObject;

  const ids = [...new Set(dto.instrumentIds)].filter(
    (instrumentId) => instrumentId !== run.instrumentId,
  );
  if (!ids.length)
    throw new BadRequestException('Escolhe mercados diferentes deste');

  const instruments = await repository.findInstrumentsByIds(ids);
  if (instruments.length !== ids.length)
    throw new NotFoundException('Ativo não encontrado');
  if (instruments.some((item) => (item.type !== 'spot') !== futures)) {
    throw new BadRequestException(
      futures
        ? 'Esta simulação é de futuros: escolhe só mercados de futuros'
        : 'Esta simulação é de spot: escolhe só mercados de spot',
    );
  }

  assertNoProfile(strategy);
  await assertRunQueue(userId, instruments.length, repository);

  const created: string[] = [];
  for (const instrument of instruments) {
    // O aquecimento da original, até ao primeiro dia com velas na corretora deste
    const dataFromDate = new Date(
      Math.max(
        run.fromDate.getTime() - warmupMs,
        earliestCandle(instrument.source),
      ),
    );
    // O perfil de volume com o tick do mercado novo
    const entries = structuredClone(strategy.entries);
    setProfileTicks(entries, instrument.metadata);
    const createdRun = await repository.createRun({
      userId,
      instrumentId: instrument.id,
      timeframe: run.timeframe,
      fromDate: run.fromDate,
      toDate: run.toDate,
      strategy: {
        ...strategy,
        entries,
        quantityStep: metadataNumber(instrument.metadata, 'stepSize'),
        minQuantity: metadataNumber(instrument.metadata, 'minQty'),
        minNotional: metadataNumber(instrument.metadata, 'minNotional'),
      },
      dataFromDate,
      monthsTotal: countMonthsInRange(dataFromDate, run.toDate),
      sourceRunId,
    });
    await repository.notify('market_data_download', createdRun.downloadId);
    await repository.notify('simulation_run', createdRun.id);
    created.push(createdRun.id);
  }
  return { sourceRunId, ids: created };
}
