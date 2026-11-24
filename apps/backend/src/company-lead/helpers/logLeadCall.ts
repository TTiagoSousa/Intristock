import { BadRequestException } from '@nestjs/common';
import {
  LeadBoardRecord,
  LeadOutcomeRecord,
  LeadStageRecord,
  PrismaCompanyLeadRepository,
} from '../repositories/prisma/prisma-company-lead-repository';
import { MAX_COMMENT } from './leadTypes';
import { callbackNoteOf, parseCallbackAt } from './setLeadCallback';
import { touchLead } from './touchLead';

/**
 * Regista uma chamada com o resultado (um dos botões da secção): conta a tentativa, passa a lead para a coluna do
 * resultado (no fim dela), marca o voltar a ligar (ou limpa o que havia: a chamada já se fez) e, com texto, deixa o
 * comentário. Tudo numa transação.
 */
export async function logLeadCall(
  repository: PrismaCompanyLeadRepository,
  board: LeadBoardRecord,
  stages: LeadStageRecord[],
  outcomes: LeadOutcomeRecord[],
  userId: string,
  input: { rowKey: string; outcomeId: string; callbackAt?: string | null; callbackNote?: string | null; comment?: string | null; position?: number },
) {
  const outcome = outcomes.find((o) => o.id === input.outcomeId);
  if (!outcome) throw new BadRequestException('Esse resultado não é desta secção');
  const callbackAt = parseCallbackAt(input.callbackAt);
  const callbackNote = callbackAt ? callbackNoteOf(input.callbackNote) : null;
  const comment = (input.comment ?? '').trim();
  if (comment.length > MAX_COMMENT) throw new BadRequestException(`O comentário tem mais de ${MAX_COMMENT} caracteres`);
  const target = outcome.stageId ? stages.find((s) => s.id === outcome.stageId) : undefined;
  const endPosition = target ? ((await repository.lastPositionInStage(target.id)) ?? 0) + 1 : null;

  return repository.transaction(async (tx) => {
    const lead = await touchLead(tx, repository, board, stages, input.rowKey, input.position);
    const now = new Date();
    const moves = Boolean(target && target.id !== lead.stageId);
    await repository.createCall(tx, { leadId: lead.id, boardId: board.id, userId, outcomeId: outcome.id, outcomeName: outcome.name, answered: outcome.answered });
    const saved = await repository.updateLead(tx, lead.id, {
      attempts: outcome.countsAsAttempt ? { increment: 1 } : undefined,
      lastCallAt: now,
      lastOutcomeId: outcome.id,
      callbackAt,
      callbackNote,
      ...(moves ? { stageId: target!.id, position: endPosition!, movedByRuleId: null, stageEnteredAt: now } : {}),
    });
    if (moves) await repository.createEvent(tx, { leadId: lead.id, userId, kind: 'moved', fromStageId: lead.stageId, toStageId: target!.id });
    if (callbackAt) await repository.createEvent(tx, { leadId: lead.id, userId, kind: 'callback' });
    if (comment) await repository.createComment(tx, { leadId: lead.id, userId, body: comment });
    return saved;
  });
}
