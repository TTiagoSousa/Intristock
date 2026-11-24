import { LeadBoardRecord, LeadStageRecord, PrismaCompanyLeadRepository } from '../repositories/prisma/prisma-company-lead-repository';
import { touchLead } from './touchLead';

/** Arquiva a lead (sai do quadro; os comentários e o histórico ficam) ou repõe-na. */
export async function archiveLead(
  repository: PrismaCompanyLeadRepository,
  board: LeadBoardRecord,
  stages: LeadStageRecord[],
  userId: string,
  input: { rowKey: string; archived: boolean; position?: number },
) {
  return repository.transaction(async (tx) => {
    const lead = await touchLead(tx, repository, board, stages, input.rowKey, input.position);
    if (Boolean(lead.archivedAt) === input.archived) return lead;
    const saved = await repository.updateLead(tx, lead.id, { archivedAt: input.archived ? new Date() : null });
    await repository.createEvent(tx, { leadId: lead.id, userId, kind: input.archived ? 'archived' : 'restored' });
    return saved;
  });
}
