import { BadRequestException } from '@nestjs/common';
import { LeadBoardRecord, LeadStageRecord, PrismaCompanyLeadRepository } from '../repositories/prisma/prisma-company-lead-repository';
import { touchLead } from './touchLead';

/** Põe a lead noutra coluna (ou noutro lugar da mesma) e regista a passagem no histórico. */
export async function moveLead(
  repository: PrismaCompanyLeadRepository,
  board: LeadBoardRecord,
  stages: LeadStageRecord[],
  userId: string,
  input: { rowKey: string; stageId: string; position: number; from?: number },
) {
  const target = stages.find((s) => s.id === input.stageId);
  if (!target) throw new BadRequestException('Essa coluna não é desta secção');
  if (!Number.isFinite(input.position)) throw new BadRequestException('A posição não é válida');

  return repository.transaction(async (tx) => {
    const lead = await touchLead(tx, repository, board, stages, input.rowKey, input.from);
    const fromStageId = lead.stageId;
    const moved = await repository.updateLead(tx, lead.id, {
      stageId: target.id,
      position: input.position,
      // Noutra coluna deixa de ser da automação (no mesmo sítio, só muda a ordem)
      ...(fromStageId !== target.id ? { movedByRuleId: null, stageEnteredAt: new Date() } : {}),
    });
    if (fromStageId !== target.id) {
      await repository.createEvent(tx, { leadId: lead.id, userId, kind: 'moved', fromStageId, toStageId: target.id });
    }
    return moved;
  });
}
