import { BadRequestException } from '@nestjs/common';
import { LeadBoardRecord, LeadStageRecord, PrismaCompanyLeadRepository } from '../repositories/prisma/prisma-company-lead-repository';
import { MAX_CALLBACK_NOTE } from './leadTypes';
import { touchLead } from './touchLead';

/** A data a que se volta a ligar, aceite como vem (até um ano à frente); `null` não serve, é «sem data». */
export function parseCallbackAt(raw: string | null | undefined): Date | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) throw new BadRequestException('A data de voltar a ligar não é válida');
  if (at.getTime() > Date.now() + 366 * 86_400_000) throw new BadRequestException('A data de voltar a ligar é daqui a mais de um ano');
  return at;
}

export const callbackNoteOf = (raw: string | null | undefined) => {
  const note = (raw ?? '').trim();
  if (note.length > MAX_CALLBACK_NOTE) throw new BadRequestException(`A nota tem mais de ${MAX_CALLBACK_NOTE} caracteres`);
  return note || null;
};

/** Marca (ou tira) quando se volta a ligar a uma lead, com uma nota curta. */
export async function setLeadCallback(
  repository: PrismaCompanyLeadRepository,
  board: LeadBoardRecord,
  stages: LeadStageRecord[],
  userId: string,
  input: { rowKey: string; callbackAt: string | null; note?: string | null; position?: number },
) {
  const callbackAt = parseCallbackAt(input.callbackAt);
  const note = callbackAt ? callbackNoteOf(input.note) : null;
  return repository.transaction(async (tx) => {
    const lead = await touchLead(tx, repository, board, stages, input.rowKey, input.position);
    const saved = await repository.updateLead(tx, lead.id, { callbackAt, callbackNote: note });
    if ((lead.callbackAt?.getTime() ?? null) !== (callbackAt?.getTime() ?? null)) {
      await repository.createEvent(tx, { leadId: lead.id, userId, kind: callbackAt ? 'callback' : 'callback_cleared' });
    }
    return saved;
  });
}
