import { BadRequestException } from '@nestjs/common';
import { LeadBoardRecord, LeadStageRecord, PrismaCompanyLeadRepository } from '../repositories/prisma/prisma-company-lead-repository';
import { MAX_COMMENT } from './leadTypes';
import { touchLead } from './touchLead';

/** Um comentário numa lead (grava a lead se ainda não existia). */
export async function addLeadComment(
  repository: PrismaCompanyLeadRepository,
  board: LeadBoardRecord,
  stages: LeadStageRecord[],
  userId: string,
  input: { rowKey: string; body: string; position?: number },
) {
  const body = input.body.trim();
  if (!body) throw new BadRequestException('O comentário está vazio');
  if (body.length > MAX_COMMENT) throw new BadRequestException(`O comentário tem mais de ${MAX_COMMENT} caracteres`);

  return repository.transaction(async (tx) => {
    const lead = await touchLead(tx, repository, board, stages, input.rowKey, input.position);
    return repository.createComment(tx, { leadId: lead.id, userId, body });
  });
}
