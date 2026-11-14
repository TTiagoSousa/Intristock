import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client/client';
import {
  EntryRuleDto,
  Timeframe,
} from 'src/simulation/dto/create-simulation.dto';
import { computeWarmupMs } from 'src/simulation/helpers/computeWarmupMs';
import { assertNoProfile } from 'src/simulation/helpers/assertNoProfile';
import { CreateLiveTestDto } from '../dto/create-live-test.dto';
import { PrismaLiveTestRepository } from '../repositories/prisma/prisma-live-test-repository';
import { MAX_ACTIVE_LIVE_TESTS } from './liveTestStatus';

// Um início um pouco no passado (o relógio do browser atrasado) conta como agora
const CLOCK_SLACK_MS = 5 * 60 * 1000;

/**
 * Cria um teste ao vivo com a estratégia da simulação (copiada: mudar a
 * simulação depois não mexe no teste) e acorda o simulador. As velas do
 * aquecimento vêm antes do início, como numa simulação.
 */
export async function createLiveTest(
  userId: string,
  dto: CreateLiveTestDto,
  repository: PrismaLiveTestRepository,
) {
  const run = await repository.findRun(dto.runId, userId);
  if (!run) throw new NotFoundException('Simulação não encontrada');

  if ((await repository.countActive(userId)) >= MAX_ACTIVE_LIVE_TESTS) {
    throw new BadRequestException(
      `Já tens ${MAX_ACTIVE_LIVE_TESTS} testes ao vivo a correr: para um antes de começar outro`,
    );
  }

  const now = Date.now();
  const startAt = dto.startAt ? new Date(dto.startAt) : new Date(now);
  if (startAt.getTime() < now - CLOCK_SLACK_MS) {
    throw new BadRequestException('O início não pode ser no passado');
  }
  const start = new Date(Math.max(startAt.getTime(), now));
  const endAt = dto.endAt ? new Date(dto.endAt) : null;
  if (endAt && endAt.getTime() <= start.getTime()) {
    throw new BadRequestException('O fim tem de ser depois do início');
  }

  const strategy = run.strategy as Prisma.JsonObject;
  // O perfil de volume já não se usa em estratégias novas
  assertNoProfile(strategy);
  const entries = (strategy.entries ?? []) as unknown as EntryRuleDto[];
  const warmupMs = computeWarmupMs(entries, run.timeframe as Timeframe);

  const test = await repository.create({
    userId,
    runId: run.id,
    instrumentId: run.instrumentId,
    timeframe: run.timeframe,
    strategy: {
      ...strategy,
      initialCapital: dto.initialCapital ?? strategy.initialCapital,
    } as Prisma.InputJsonObject,
    startAt: start,
    endAt,
    dataFromDate: new Date(start.getTime() - warmupMs),
  });
  await repository.notify('live_test', test.id);
  return test;
}
