import { BadRequestException, ConflictException } from '@nestjs/common';
import { LeadOutcomeRecord, LeadStageRecord, PrismaCompanyLeadRepository } from '../repositories/prisma/prisma-company-lead-repository';
import { MAX_OUTCOMES } from './leadTypes';

export interface LeadOutcomeInput {
  name?: string;
  stageId?: string | null;
  answered?: boolean;
  countsAsAttempt?: boolean;
  asksCallback?: boolean;
  position?: number;
}

const nameOf = (raw: string) => {
  const name = raw.trim().slice(0, 40);
  if (!name) throw new BadRequestException('O resultado precisa de um nome');
  return name;
};

const assertFree = (outcomes: LeadOutcomeRecord[], name: string, except?: string) => {
  if (outcomes.some((o) => o.id !== except && o.name.toLocaleLowerCase('pt-PT') === name.toLocaleLowerCase('pt-PT'))) {
    throw new ConflictException(`Já há um resultado «${name}»`);
  }
};

const assertStage = (stages: LeadStageRecord[], stageId: string | null | undefined) => {
  if (stageId && !stages.some((s) => s.id === stageId)) throw new BadRequestException('Essa coluna não é desta secção');
};

/** Um botão de resultado novo, no fim. */
export async function createLeadOutcome(
  repository: PrismaCompanyLeadRepository,
  boardId: string,
  stages: LeadStageRecord[],
  outcomes: LeadOutcomeRecord[],
  input: LeadOutcomeInput & { name: string },
) {
  if (outcomes.length >= MAX_OUTCOMES) throw new BadRequestException(`No máximo ${MAX_OUTCOMES} resultados`);
  const name = nameOf(input.name);
  assertFree(outcomes, name);
  assertStage(stages, input.stageId);
  return repository.createOutcome({
    boardId,
    name,
    stageId: input.stageId ?? null,
    answered: input.answered ?? false,
    countsAsAttempt: input.countsAsAttempt ?? true,
    asksCallback: input.asksCallback ?? false,
    position: Math.max(-1, ...outcomes.map((o) => o.position)) + 1,
  });
}

/** Muda um botão (o que vem no pedido) ou o lugar dele (as outros chegam-se). */
export async function updateLeadOutcome(
  repository: PrismaCompanyLeadRepository,
  stages: LeadStageRecord[],
  outcomes: LeadOutcomeRecord[],
  outcome: LeadOutcomeRecord,
  input: LeadOutcomeInput,
) {
  const name = input.name !== undefined ? nameOf(input.name) : undefined;
  if (name) assertFree(outcomes, name, outcome.id);
  assertStage(stages, input.stageId);
  await repository.updateOutcome(outcome.id, {
    ...(name ? { name } : {}),
    ...(input.stageId !== undefined ? { stageId: input.stageId } : {}),
    ...(input.answered !== undefined ? { answered: input.answered } : {}),
    ...(input.countsAsAttempt !== undefined ? { countsAsAttempt: input.countsAsAttempt } : {}),
    ...(input.asksCallback !== undefined ? { asksCallback: input.asksCallback } : {}),
  });
  if (input.position !== undefined) {
    const order = outcomes.filter((o) => o.id !== outcome.id);
    order.splice(Math.max(0, Math.min(input.position, order.length)), 0, outcome);
    await repository.transaction(async (tx) => {
      for (const [index, o] of order.entries()) if (o.position !== index) await repository.updateOutcome(o.id, { position: index }, tx);
    });
  }
  return repository.findOutcomes(outcome.boardId);
}
