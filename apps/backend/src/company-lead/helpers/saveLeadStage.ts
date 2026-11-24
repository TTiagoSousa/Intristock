import { BadRequestException, ConflictException } from '@nestjs/common';
import { LeadBoardRecord, LeadStageRecord, PrismaCompanyLeadRepository } from '../repositories/prisma/prisma-company-lead-repository';
import { MAX_CARD_LIMIT, MAX_STAGES } from './leadTypes';

const nameOf = (raw: string) => {
  const name = raw.trim().slice(0, 60);
  if (!name) throw new BadRequestException('A coluna precisa de um nome');
  return name;
};

const assertFree = (stages: LeadStageRecord[], name: string, except?: string) => {
  if (stages.some((s) => s.id !== except && s.name.toLocaleLowerCase('pt-PT') === name.toLocaleLowerCase('pt-PT'))) {
    throw new ConflictException(`Já há uma coluna «${name}»`);
  }
};

/** Uma coluna nova, no fim do quadro. */
export async function createLeadStage(repository: PrismaCompanyLeadRepository, board: LeadBoardRecord, stages: LeadStageRecord[], raw: string) {
  if (stages.length >= MAX_STAGES) throw new BadRequestException(`No máximo ${MAX_STAGES} colunas`);
  const name = nameOf(raw);
  assertFree(stages, name);
  const position = Math.max(-1, ...stages.map((s) => s.position)) + 1;
  return repository.createStage({ boardId: board.id, name, position });
}

/** Muda o nome, o limite de cartões ou o lugar de uma coluna (o lugar é o índice no quadro; as outras chegam-se). */
export async function updateLeadStage(
  repository: PrismaCompanyLeadRepository,
  stages: LeadStageRecord[],
  stage: LeadStageRecord,
  input: { name?: string; position?: number; cardLimit?: number | null },
) {
  if (input.cardLimit !== undefined) {
    if (input.cardLimit !== null && (!Number.isInteger(input.cardLimit) || input.cardLimit < 1 || input.cardLimit > MAX_CARD_LIMIT)) {
      throw new BadRequestException(`O limite é entre 1 e ${MAX_CARD_LIMIT} cartões`);
    }
    await repository.updateStage(stage.id, { cardLimit: input.cardLimit });
  }
  if (input.name !== undefined) {
    const name = nameOf(input.name);
    assertFree(stages, name, stage.id);
    await repository.updateStage(stage.id, { name });
  }
  if (input.position !== undefined) {
    const order = stages.filter((s) => s.id !== stage.id);
    order.splice(Math.max(0, Math.min(input.position, order.length)), 0, stage);
    await repository.transaction(async (tx) => {
      for (const [index, s] of order.entries()) if (s.position !== index) await repository.updateStage(s.id, { position: index }, tx);
    });
  }
  return repository.findStages(stage.boardId);
}

/** Apaga uma coluna vazia (a de entrada não); as leads arquivadas que lá estavam passam para a de entrada. */
export async function deleteLeadStage(repository: PrismaCompanyLeadRepository, stages: LeadStageRecord[], stage: LeadStageRecord) {
  if (stage.isEntry) throw new BadRequestException('A coluna de entrada não se apaga');
  if (await repository.countLeadsInStage(stage.id, false)) {
    throw new ConflictException('A coluna tem leads: move-as primeiro para outra');
  }
  const entry = stages.find((s) => s.isEntry) ?? stages.find((s) => s.id !== stage.id)!;
  await repository.deleteStage(stage.id, entry.id);
  return { ok: true };
}
