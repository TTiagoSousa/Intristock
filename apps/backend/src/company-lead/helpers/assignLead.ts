import { BadRequestException } from '@nestjs/common';
import { LeadBoardRecord, LeadStageRecord, PrismaCompanyLeadRepository } from '../repositories/prisma/prisma-company-lead-repository';
import { touchLead } from './touchLead';

/** Dá a lead a alguém que trabalha nas leads (ou tira-a, com `null`) e regista-o no histórico. */
export async function assignLead(
  repository: PrismaCompanyLeadRepository,
  board: LeadBoardRecord,
  stages: LeadStageRecord[],
  userId: string,
  input: { rowKey: string; assignedToId: string | null; position?: number },
  people: Set<string>,
) {
  if (input.assignedToId && !people.has(input.assignedToId)) throw new BadRequestException('Essa pessoa não trabalha nas leads desta empresa');
  return repository.transaction(async (tx) => {
    const lead = await touchLead(tx, repository, board, stages, input.rowKey, input.position);
    if ((lead.assignedToId ?? null) === input.assignedToId) return lead;
    const saved = await repository.updateLead(tx, lead.id, {
      assignedToId: input.assignedToId,
      assignedAt: input.assignedToId ? new Date() : null,
    });
    await repository.createEvent(tx, { leadId: lead.id, userId, kind: input.assignedToId ? 'assigned' : 'unassigned' });
    return saved;
  });
}
