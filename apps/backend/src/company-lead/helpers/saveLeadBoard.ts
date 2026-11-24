import { BadRequestException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client/client';
import { SourceColumn } from 'src/company-data/company-data.service';
import { LeadBoardRecord, PrismaCompanyLeadRepository } from '../repositories/prisma/prisma-company-lead-repository';
import { assertBoardSettings, BoardSettingsInput } from './assertBoardSettings';
import { DEFAULT_OUTCOMES, DEFAULT_STAGES, LeadSourceType, MAX_BOARDS } from './leadTypes';

const nameOf = (raw: string) => {
  const name = raw.trim().slice(0, 80);
  if (!name) throw new BadRequestException('A secção precisa de um nome');
  return name;
};

const sourceOf = (type: LeadSourceType, id: string) => ({ sourceType: type, tableId: type === 'table' ? id : null, viewId: type === 'view' ? id : null });

const settingsData = (settings: ReturnType<typeof assertBoardSettings>) => ({
  filters: settings.filters as Prisma.InputJsonValue,
  search: settings.search,
  only: settings.only,
  phoneColumn: settings.phoneColumn,
  titleColumn: settings.titleColumn,
  cardColumns: settings.cardColumns,
});

/** Uma secção nova, no fim, com as colunas e os botões de resultado por omissão (a primeira coluna é a de entrada). */
export async function createLeadBoard(
  repository: PrismaCompanyLeadRepository,
  companyId: string,
  userId: string,
  input: BoardSettingsInput & { name: string; sourceType: LeadSourceType; sourceId: string },
  columns: SourceColumn[],
) {
  const boards = await repository.findBoards(companyId);
  if (boards.length >= MAX_BOARDS) throw new BadRequestException(`No máximo ${MAX_BOARDS} secções`);
  const settings = assertBoardSettings(input, columns, input.sourceType);
  const position = await repository.nextBoardPosition(companyId);

  return repository.transaction(async (tx) => {
    const board = await repository.createBoard(tx, {
      companyId,
      name: nameOf(input.name),
      ...sourceOf(input.sourceType, input.sourceId),
      ...settingsData(settings),
      position,
      createdById: userId,
    });
    await repository.createStages(
      tx,
      DEFAULT_STAGES.map((name, index) => ({ boardId: board.id, name, position: index, isEntry: index === 0 })),
    );
    const stages = await repository.findStages(board.id, tx);
    await repository.createOutcomes(
      tx,
      DEFAULT_OUTCOMES.map((o, index) => ({
        boardId: board.id,
        name: o.name,
        stageId: stages.find((s) => s.name === o.stage)?.id ?? null,
        answered: o.answered,
        asksCallback: o.asksCallback,
        position: index,
      })),
    );
    return board;
  });
}

/**
 * Muda o nome, a origem, as definições, o lugar ou o arquivo de uma secção. Ao mudar de origem as leads
 * que lá estavam deixam de bater com as linhas (ficam guardadas, não se veem).
 */
export async function updateLeadBoard(
  repository: PrismaCompanyLeadRepository,
  board: LeadBoardRecord,
  input: BoardSettingsInput & { name?: string; sourceType?: LeadSourceType; sourceId?: string; position?: number; archived?: boolean },
  columns: SourceColumn[] | null,
) {
  const data: Prisma.CompanyLeadBoardUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = nameOf(input.name);
  if (input.sourceType && input.sourceId) Object.assign(data, sourceOf(input.sourceType, input.sourceId));
  if (columns) {
    const sourceType = input.sourceType ?? (board.sourceType as LeadSourceType);
    // Noutra origem as colunas de antes não servem: só vale o que vem no pedido
    const changed = Boolean(input.sourceId && input.sourceId !== (board.tableId ?? board.viewId));
    const base: BoardSettingsInput = changed ? {} : board;
    const merged: BoardSettingsInput = {
      filters: input.filters ?? base.filters,
      search: input.search !== undefined ? input.search : base.search,
      only: input.only !== undefined ? input.only : base.only,
      phoneColumn: input.phoneColumn !== undefined ? input.phoneColumn : base.phoneColumn,
      titleColumn: input.titleColumn !== undefined ? input.titleColumn : base.titleColumn,
      cardColumns: input.cardColumns ?? base.cardColumns,
    };
    Object.assign(data, settingsData(assertBoardSettings(merged, columns, sourceType)));
  }
  if (input.position !== undefined) data.position = input.position;
  if (input.archived !== undefined) data.archived = input.archived;
  return repository.updateBoard(board.id, data);
}
