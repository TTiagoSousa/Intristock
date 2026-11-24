import { Prisma } from 'src/generated/prisma/client/client';
import { LeadBoardRecord, LeadStageRecord, PrismaCompanyLeadRepository } from '../repositories/prisma/prisma-company-lead-repository';
import { UNTOUCHED_POSITION } from './leadTypes';

type Tx = Prisma.TransactionClient;

/**
 * A lead de uma linha, criada na coluna de entrada se ainda ninguém lhe tinha mexido (comentar ou arquivar
 * também a grava). `position` é a que o cartão tinha no ecrã, para não saltar de lugar.
 */
export async function touchLead(
  tx: Tx,
  repository: PrismaCompanyLeadRepository,
  board: LeadBoardRecord,
  stages: LeadStageRecord[],
  rowKey: string,
  position?: number,
) {
  const existing = await repository.findLead(board.id, rowKey, tx);
  if (existing) return existing;
  const entry = stages.find((s) => s.isEntry) ?? stages[0];
  return repository.createLead(tx, {
    boardId: board.id,
    rowKey,
    stageId: entry.id,
    position: Number.isFinite(position) ? position! : UNTOUCHED_POSITION,
  });
}
