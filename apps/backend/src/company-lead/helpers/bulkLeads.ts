import { BadRequestException } from '@nestjs/common';
import { LeadBoardRecord, LeadStageRecord, PrismaCompanyLeadRepository } from '../repositories/prisma/prisma-company-lead-repository';
import { MAX_BULK } from './leadTypes';
import { touchLead } from './touchLead';

export const BULK_ACTIONS = ['move', 'archive', 'restore', 'assign'] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

/**
 * A mesma ação em várias leads de uma vez (as escolhidas no quadro): mover para o fim de uma coluna, arquivar,
 * repor ou atribuir. Uma transação: ou todas ou nenhuma. Devolve quantas mudaram.
 */
export async function bulkLeads(
  repository: PrismaCompanyLeadRepository,
  board: LeadBoardRecord,
  stages: LeadStageRecord[],
  userId: string,
  input: { rows: { rowKey: string; position?: number }[]; action: BulkAction; stageId?: string | null; assignedToId?: string | null },
  people: Set<string>,
) {
  const rows = [...new Map(input.rows.map((r) => [r.rowKey, r])).values()];
  if (!rows.length) throw new BadRequestException('Escolhe pelo menos uma lead');
  if (rows.length > MAX_BULK) throw new BadRequestException(`No máximo ${MAX_BULK} leads de uma vez`);
  const target = input.action === 'move' ? stages.find((s) => s.id === input.stageId) : undefined;
  if (input.action === 'move' && !target) throw new BadRequestException('Escolhe a coluna para onde vão');
  const assignee = input.action === 'assign' ? (input.assignedToId ?? null) : null;
  if (assignee && !people.has(assignee)) throw new BadRequestException('Essa pessoa não trabalha nas leads desta empresa');
  let position = target ? ((await repository.lastPositionInStage(target.id)) ?? 0) : 0;

  return repository.transaction(async (tx) => {
    let changed = 0;
    const now = new Date();
    for (const row of rows) {
      const lead = await touchLead(tx, repository, board, stages, row.rowKey, row.position);
      if (input.action === 'move') {
        if (lead.stageId === target!.id) continue;
        position += 1;
        await repository.updateLead(tx, lead.id, { stageId: target!.id, position, movedByRuleId: null, stageEnteredAt: now });
        await repository.createEvent(tx, { leadId: lead.id, userId, kind: 'moved', fromStageId: lead.stageId, toStageId: target!.id });
      } else if (input.action === 'archive' || input.action === 'restore') {
        const archive = input.action === 'archive';
        if (Boolean(lead.archivedAt) === archive) continue;
        await repository.updateLead(tx, lead.id, { archivedAt: archive ? now : null });
        await repository.createEvent(tx, { leadId: lead.id, userId, kind: archive ? 'archived' : 'restored' });
      } else {
        if ((lead.assignedToId ?? null) === assignee) continue;
        await repository.updateLead(tx, lead.id, { assignedToId: assignee, assignedAt: assignee ? now : null });
        await repository.createEvent(tx, { leadId: lead.id, userId, kind: assignee ? 'assigned' : 'unassigned' });
      }
      changed++;
    }
    return { changed };
  }, { timeout: 30_000 });
}
