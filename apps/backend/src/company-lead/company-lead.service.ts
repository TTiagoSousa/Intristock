import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { CompanyDataService, DataSource, SourceRow } from 'src/company-data/company-data.service';
import { maskRow } from 'src/company-data/helpers/maskRow';
import { assertDataAccess } from 'src/company-data/helpers/assertDataAccess';
import { ViewFilter } from 'src/company-data/helpers/pageJoinedRows';
import { LeadBoardRecord, LeadStageRecord, PrismaCompanyLeadRepository } from './repositories/prisma/prisma-company-lead-repository';
import {
  AddLeadCommentDto,
  ArchiveLeadDto,
  AssignLeadDto,
  BulkLeadsDto,
  CreateLeadOutcomeDto,
  LeadCallbackDto,
  LeadDashboardQueryDto,
  LogLeadCallDto,
  RowCommentsQueryDto,
  UpdateLeadOutcomeDto,
  CreateLeadBoardDto,
  CreateLeadRuleDto,
  CreateLeadStageDto,
  EditLeadCommentDto,
  MoveLeadDto,
  UpdateLeadBoardDto,
  UpdateLeadRuleDto,
  UpdateLeadStageDto,
} from './dto/company-lead.dto';
import { buildBoard } from './helpers/buildBoard';
import { createLeadBoard, updateLeadBoard } from './helpers/saveLeadBoard';
import { createLeadStage, deleteLeadStage, updateLeadStage } from './helpers/saveLeadStage';
import { moveLead } from './helpers/moveLead';
import { addLeadComment } from './helpers/addLeadComment';
import { archiveLead } from './helpers/archiveLead';
import { findLeadDetail } from './helpers/findLeadDetail';
import { LeadSourceType, MAX_BOARD_ROWS, MAX_COMMENT, UNTOUCHED_POSITION } from './helpers/leadTypes';
import { applyLeadRules } from './helpers/applyLeadRules';
import { createLeadRule, updateLeadRule } from './helpers/saveLeadRule';
import { findLeadPeople } from './helpers/findLeadPeople';
import { assignLead } from './helpers/assignLead';
import { setLeadCallback } from './helpers/setLeadCallback';
import { logLeadCall } from './helpers/logLeadCall';
import { createLeadOutcome, updateLeadOutcome } from './helpers/saveLeadOutcome';
import { bulkLeads } from './helpers/bulkLeads';
import { summarizeLeads } from './helpers/summarizeLeads';

const DASHBOARD_MAX_DAYS = 366;
const timeZoneOf = (raw?: string) => {
  try {
    if (raw) new Intl.DateTimeFormat('en', { timeZone: raw });
    return raw || 'Europe/Lisbon';
  } catch {
    return 'Europe/Lisbon';
  }
};

type LeadPermission = 'leads.view' | 'leads.work' | 'leads.manage';

const sourceOf = (board: LeadBoardRecord): DataSource => ({
  type: board.sourceType as LeadSourceType,
  id: (board.sourceType === 'view' ? board.viewId : board.tableId) ?? '',
});

/** As Leads do call center: as secções (quadros), as colunas, mover, comentar e arquivar. */
@Injectable()
export class CompanyLeadService {
  constructor(
    private readonly repository: PrismaCompanyLeadRepository,
    private readonly companyRepository: PrismaCompanyRepository,
    private readonly data: CompanyDataService,
  ) {}

  private access(userId: string, companyId: string, permission: LeadPermission) {
    return assertDataAccess(userId, companyId, this.companyRepository, permission, 'Não tens acesso às leads desta empresa');
  }

  private async peopleIds(companyId: string) {
    const company = await this.companyRepository.findById(companyId);
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return new Set((await findLeadPeople(this.companyRepository, this.repository, company)).map((p) => p.id));
  }

  private async boardOf(companyId: string, boardId: string) {
    const board = await this.repository.findBoard(boardId);
    if (!board || board.companyId !== companyId) throw new NotFoundException('Secção não encontrada');
    return board;
  }

  private async boardWithStages(companyId: string, boardId: string) {
    const board = await this.boardOf(companyId, boardId);
    const stages = await this.repository.findStages(board.id);
    return { board, stages };
  }

  /** A linha de uma lead tem de existir na origem (ou já ter uma lead), para não se gravarem chaves soltas. */
  private async assertRow(companyId: string, board: LeadBoardRecord, rowKey: string) {
    if (await this.repository.findLead(board.id, rowKey)) return;
    const read = await this.data.readSource(companyId, sourceOf(board), false, { limit: 0, extraRefs: [rowKey] });
    if (!read.extra.length) throw new BadRequestException('Essa linha não existe na origem');
  }

  // ── secções ──

  async boards(userId: string, companyId: string) {
    await this.access(userId, companyId, 'leads.view');
    const boards = await this.repository.findBoards(companyId);
    return boards.map(({ table, view, ...board }) => ({ ...board, sourceName: table?.name ?? view?.name ?? null }));
  }

  /**
   * Lê a origem de uma secção, cria as leads das linhas novas e corre as automações (o quadro e a tarefa em fundo
   * usam o mesmo). Sem •••: as automações veem os dados todos (o que sai para o ecrã esconde-se depois).
   */
  async syncBoard(board: LeadBoardRecord, stages: LeadStageRecord[]) {
    const companyId = board.companyId;
    let leads = await this.repository.findLeads(board.id);
    const rules = await this.repository.findRules(board.id);

    let read: Awaited<ReturnType<CompanyDataService['readSource']>>;
    let sourceName: string | null = null;
    let error: string | null = null;
    try {
      const source = sourceOf(board);
      sourceName = (await this.data.sourceInfo(companyId, source)).name;
      // Sem •••: as automações veem os dados todos (o que sai para o ecrã esconde-se a seguir)
      read = await this.data.readSource(companyId, source, true, {
        filters: JSON.stringify(board.filters ?? []),
        search: board.search ?? undefined,
        only: (board.only as ViewFilter | null) ?? undefined,
        limit: MAX_BOARD_ROWS,
        extraRefs: leads.map((l) => l.rowKey),
      });
    } catch (e) {
      // A origem mudou (uma coluna dos filtros saiu, a tabela desapareceu): o quadro abre com o aviso
      if (!(e instanceof BadRequestException || e instanceof NotFoundException)) throw e;
      error = e.message;
      read = { columns: [], rows: [], total: 0, extra: [] };
    }

    if (!error) {
      // Cada linha que entra fica com a lead dela (para a secção saber que lá esteve quando os dados mudarem)
      const entry = stages.find((s) => s.isEntry) ?? stages[0];
      const known = new Set(leads.map((l) => l.rowKey));
      const missing = read.rows
        .map((row, index) => ({ rowKey: row.ref, position: UNTOUCHED_POSITION + index }))
        .filter((row) => !known.has(row.rowKey));
      if (entry && (await this.repository.createMissingLeads(board.id, entry.id, missing))) leads = await this.repository.findLeads(board.id);
      const applied = await applyLeadRules(this.repository, { leads, rules, columns: read.columns, rows: [...read.rows, ...read.extra] });
      if (applied) leads = await this.repository.findLeads(board.id);
    }
    return { leads, rules, read, sourceName, error };
  }

  async board(userId: string, companyId: string, boardId: string, show: { archived?: boolean; left?: boolean } = {}) {
    const showArchived = show.archived === true;
    const { company, canSeePersonal } = await this.access(userId, companyId, 'leads.view');
    const { board, stages } = await this.boardWithStages(companyId, boardId);
    const { leads, rules, read, sourceName, error } = await this.syncBoard(board, stages);
    const [outcomes, people] = await Promise.all([this.repository.findOutcomes(board.id), findLeadPeople(this.companyRepository, this.repository, company)]);
    const cardColumns = board.cardColumns as string[];
    const keep = [...new Set([board.titleColumn, board.phoneColumn, ...cardColumns].filter((k): k is string => Boolean(k)))];

    const mask = (row: SourceRow) => (canSeePersonal ? row : { ...row, values: maskRow(row.values, read.columns) });
    const built = buildBoard({
      stages,
      leads: leads.map((l) => ({ ...l, comments: l._count.comments })),
      rows: read.rows.map(mask),
      extra: read.extra.map(mask),
      ruleNames: new Map(rules.map((r) => [r.id, r.name])),
      outcomeNames: new Map(outcomes.map((o) => [o.id, o.name])),
      truncated: read.total > read.rows.length,
      keep,
      showArchived,
      showLeft: show.left === true,
    });

    return {
      board: { ...board, sourceId: sourceOf(board).id, sourceName },
      columns: read.columns,
      personalVisible: canSeePersonal,
      ...built,
      total: read.total,
      truncated: read.total > read.rows.length,
      error,
      outcomes,
      people,
      me: userId,
    };
  }

  async createBoard(userId: string, companyId: string, dto: CreateLeadBoardDto) {
    await this.access(userId, companyId, 'leads.manage');
    const { columns } = await this.data.sourceInfo(companyId, { type: dto.sourceType, id: dto.sourceId });
    return createLeadBoard(this.repository, companyId, userId, dto, columns);
  }

  async updateBoard(userId: string, companyId: string, boardId: string, dto: UpdateLeadBoardDto) {
    await this.access(userId, companyId, 'leads.manage');
    const board = await this.boardOf(companyId, boardId);
    if (Boolean(dto.sourceType) !== Boolean(dto.sourceId)) throw new BadRequestException('A origem precisa do tipo e do id');
    const touchesSettings = ['sourceId', 'filters', 'search', 'only', 'phoneColumn', 'titleColumn', 'cardColumns'].some(
      (k) => dto[k as keyof UpdateLeadBoardDto] !== undefined,
    );
    const source: DataSource = dto.sourceType && dto.sourceId ? { type: dto.sourceType, id: dto.sourceId } : sourceOf(board);
    const columns = touchesSettings ? (await this.data.sourceInfo(companyId, source)).columns : null;
    return updateLeadBoard(this.repository, board, dto, columns);
  }

  async deleteBoard(userId: string, companyId: string, boardId: string) {
    await this.access(userId, companyId, 'leads.manage');
    const board = await this.boardOf(companyId, boardId);
    await this.repository.deleteBoard(board.id);
    return { ok: true };
  }

  // ── colunas ──

  async createStage(userId: string, companyId: string, boardId: string, dto: CreateLeadStageDto) {
    await this.access(userId, companyId, 'leads.manage');
    const { board, stages } = await this.boardWithStages(companyId, boardId);
    return createLeadStage(this.repository, board, stages, dto.name);
  }

  async updateStage(userId: string, companyId: string, boardId: string, stageId: string, dto: UpdateLeadStageDto) {
    await this.access(userId, companyId, 'leads.manage');
    const { stages } = await this.boardWithStages(companyId, boardId);
    const stage = stages.find((s) => s.id === stageId);
    if (!stage) throw new NotFoundException('Coluna não encontrada');
    return updateLeadStage(this.repository, stages, stage, dto);
  }

  async deleteStage(userId: string, companyId: string, boardId: string, stageId: string) {
    await this.access(userId, companyId, 'leads.manage');
    const { stages } = await this.boardWithStages(companyId, boardId);
    const stage = stages.find((s) => s.id === stageId);
    if (!stage) throw new NotFoundException('Coluna não encontrada');
    return deleteLeadStage(this.repository, stages, stage);
  }

  // ── automações ──

  async rules(userId: string, companyId: string, boardId: string) {
    await this.access(userId, companyId, 'leads.view');
    const board = await this.boardOf(companyId, boardId);
    return this.repository.findRules(board.id);
  }

  async createRule(userId: string, companyId: string, boardId: string, dto: CreateLeadRuleDto) {
    await this.access(userId, companyId, 'leads.manage');
    const { board, stages } = await this.boardWithStages(companyId, boardId);
    const { columns } = await this.data.sourceInfo(companyId, sourceOf(board));
    return createLeadRule(this.repository, board, stages, userId, dto, columns, await this.peopleIds(companyId));
  }

  async updateRule(userId: string, companyId: string, boardId: string, ruleId: string, dto: UpdateLeadRuleDto) {
    await this.access(userId, companyId, 'leads.manage');
    const { board, stages } = await this.boardWithStages(companyId, boardId);
    const rules = await this.repository.findRules(board.id);
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) throw new NotFoundException('Automação não encontrada');
    const { columns } = await this.data.sourceInfo(companyId, sourceOf(board));
    return updateLeadRule(this.repository, rules, rule, stages, dto, columns, await this.peopleIds(companyId));
  }

  async deleteRule(userId: string, companyId: string, boardId: string, ruleId: string) {
    await this.access(userId, companyId, 'leads.manage');
    const board = await this.boardOf(companyId, boardId);
    const rule = (await this.repository.findRules(board.id)).find((r) => r.id === ruleId);
    if (!rule) throw new NotFoundException('Automação não encontrada');
    await this.repository.deleteRule(rule.id);
    return { ok: true };
  }

  // ── leads ──

  async lead(userId: string, companyId: string, boardId: string, rowKey: string) {
    const { canSeePersonal } = await this.access(userId, companyId, 'leads.view');
    const { board, stages } = await this.boardWithStages(companyId, boardId);
    const read = await this.data.readSource(companyId, sourceOf(board), canSeePersonal, { limit: 0, extraRefs: [rowKey] });
    const row = read.extra[0] ?? null;
    if (!row && !(await this.repository.findLead(board.id, rowKey))) throw new NotFoundException('Lead não encontrada');
    const [rules, outcomes] = await Promise.all([this.repository.findRules(board.id), this.repository.findOutcomes(board.id)]);
    const detail = await findLeadDetail(this.repository, board, stages, userId, {
      rowKey,
      columns: read.columns,
      row,
      ruleNames: new Map(rules.map((r) => [r.id, r.name])),
      outcomeNames: new Map(outcomes.map((o) => [o.id, o.name])),
    });
    return { ...detail, personalVisible: canSeePersonal };
  }

  async move(userId: string, companyId: string, boardId: string, dto: MoveLeadDto) {
    await this.access(userId, companyId, 'leads.work');
    const { board, stages } = await this.boardWithStages(companyId, boardId);
    await this.assertRow(companyId, board, dto.rowKey);
    return moveLead(this.repository, board, stages, userId, dto);
  }

  async archive(userId: string, companyId: string, boardId: string, dto: ArchiveLeadDto) {
    await this.access(userId, companyId, 'leads.work');
    const { board, stages } = await this.boardWithStages(companyId, boardId);
    await this.assertRow(companyId, board, dto.rowKey);
    return archiveLead(this.repository, board, stages, userId, dto);
  }

  async addComment(userId: string, companyId: string, boardId: string, dto: AddLeadCommentDto) {
    await this.access(userId, companyId, 'leads.work');
    const { board, stages } = await this.boardWithStages(companyId, boardId);
    await this.assertRow(companyId, board, dto.rowKey);
    return addLeadComment(this.repository, board, stages, userId, dto);
  }

  private async ownComment(userId: string, companyId: string, boardId: string, commentId: string) {
    await this.access(userId, companyId, 'leads.work');
    const board = await this.boardOf(companyId, boardId);
    const comment = await this.repository.findComment(commentId);
    if (!comment || comment.lead.boardId !== board.id) throw new NotFoundException('Comentário não encontrado');
    if (comment.userId !== userId) throw new ForbiddenException('Só quem escreveu o comentário o muda ou apaga');
    return comment;
  }

  async editComment(userId: string, companyId: string, boardId: string, commentId: string, dto: EditLeadCommentDto) {
    const comment = await this.ownComment(userId, companyId, boardId, commentId);
    const body = dto.body.trim();
    if (!body) throw new BadRequestException('O comentário está vazio');
    if (body.length > MAX_COMMENT) throw new BadRequestException(`O comentário tem mais de ${MAX_COMMENT} caracteres`);
    return this.repository.updateComment(comment.id, body);
  }

  async deleteComment(userId: string, companyId: string, boardId: string, commentId: string) {
    const comment = await this.ownComment(userId, companyId, boardId, commentId);
    await this.repository.deleteComment(comment.id);
    return { ok: true };
  }

  async assign(userId: string, companyId: string, boardId: string, dto: AssignLeadDto) {
    await this.access(userId, companyId, 'leads.work');
    const { board, stages } = await this.boardWithStages(companyId, boardId);
    await this.assertRow(companyId, board, dto.rowKey);
    return assignLead(this.repository, board, stages, userId, dto, await this.peopleIds(companyId));
  }

  async callback(userId: string, companyId: string, boardId: string, dto: LeadCallbackDto) {
    await this.access(userId, companyId, 'leads.work');
    const { board, stages } = await this.boardWithStages(companyId, boardId);
    await this.assertRow(companyId, board, dto.rowKey);
    return setLeadCallback(this.repository, board, stages, userId, dto);
  }

  async logCall(userId: string, companyId: string, boardId: string, dto: LogLeadCallDto) {
    await this.access(userId, companyId, 'leads.work');
    const { board, stages } = await this.boardWithStages(companyId, boardId);
    await this.assertRow(companyId, board, dto.rowKey);
    const outcomes = await this.repository.findOutcomes(board.id);
    return logLeadCall(this.repository, board, stages, outcomes, userId, dto);
  }

  async bulk(userId: string, companyId: string, boardId: string, dto: BulkLeadsDto) {
    await this.access(userId, companyId, 'leads.work');
    const { board, stages } = await this.boardWithStages(companyId, boardId);
    // Só as linhas que existem (ou que já têm lead)
    const known = new Set((await this.repository.findLeads(board.id)).map((l) => l.rowKey));
    const unknown = dto.rows.filter((r) => !known.has(r.rowKey)).map((r) => r.rowKey);
    if (unknown.length) {
      const read = await this.data.readSource(companyId, sourceOf(board), false, { limit: 0, extraRefs: unknown });
      if (read.extra.length < new Set(unknown).size) throw new BadRequestException('Uma das linhas não existe na origem');
    }
    return bulkLeads(this.repository, board, stages, userId, dto, await this.peopleIds(companyId));
  }

  // ── botões de resultado ──

  async outcomes(userId: string, companyId: string, boardId: string) {
    await this.access(userId, companyId, 'leads.view');
    const board = await this.boardOf(companyId, boardId);
    return this.repository.findOutcomes(board.id);
  }

  async createOutcome(userId: string, companyId: string, boardId: string, dto: CreateLeadOutcomeDto) {
    await this.access(userId, companyId, 'leads.manage');
    const { board, stages } = await this.boardWithStages(companyId, boardId);
    return createLeadOutcome(this.repository, board.id, stages, await this.repository.findOutcomes(board.id), dto);
  }

  async updateOutcome(userId: string, companyId: string, boardId: string, outcomeId: string, dto: UpdateLeadOutcomeDto) {
    await this.access(userId, companyId, 'leads.manage');
    const { board, stages } = await this.boardWithStages(companyId, boardId);
    const outcomes = await this.repository.findOutcomes(board.id);
    const outcome = outcomes.find((o) => o.id === outcomeId);
    if (!outcome) throw new NotFoundException('Resultado não encontrado');
    return updateLeadOutcome(this.repository, stages, outcomes, outcome, dto);
  }

  async deleteOutcome(userId: string, companyId: string, boardId: string, outcomeId: string) {
    await this.access(userId, companyId, 'leads.manage');
    const board = await this.boardOf(companyId, boardId);
    const outcome = (await this.repository.findOutcomes(board.id)).find((o) => o.id === outcomeId);
    if (!outcome) throw new NotFoundException('Resultado não encontrado');
    // As chamadas ficam (com o nome do resultado no momento)
    await this.repository.deleteOutcome(outcome.id);
    return { ok: true };
  }

  // ── dashboard ──

  async dashboard(userId: string, companyId: string, query: LeadDashboardQueryDto) {
    const { company } = await this.access(userId, companyId, 'leads.view');
    const now = new Date();
    const to = query.to ? new Date(query.to) : now;
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - 30 * 86_400_000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) throw new BadRequestException('O período não é válido');
    if (to.getTime() - from.getTime() > DASHBOARD_MAX_DAYS * 86_400_000) throw new BadRequestException(`No máximo ${DASHBOARD_MAX_DAYS} dias`);

    const boards = (await this.repository.findBoards(companyId)).filter((b) => !b.archived && (!query.boardId || b.id === query.boardId));
    if (query.boardId && !boards.length) throw new NotFoundException('Secção não encontrada');
    const boardIds = boards.map((b) => b.id);
    const [calls, moves, leads, stages, people] = await Promise.all([
      this.repository.findCallsBetween(boardIds, from, to),
      this.repository.findMovesBetween(boardIds, new Date(from.getTime() - 180 * 86_400_000), to),
      this.repository.findLeadsOf(boardIds),
      this.repository.findStagesOf(boardIds),
      findLeadPeople(this.companyRepository, this.repository, company),
    ]);
    const missing = [...new Set(calls.map((c) => c.userId))].filter((id) => !people.some((p) => p.id === id));
    const others = await this.repository.findUserNames(missing);
    const names = new Map([...people.map((p) => [p.id, p.name] as const), ...others.map((u) => [u.id, u.fullName] as const)]);

    return {
      from,
      to,
      boards: boards.map((b) => ({ id: b.id, name: b.name })),
      // As colunas pela ordem das secções e, dentro de cada uma, pela do quadro
      ...summarizeLeads({
        calls,
        moves,
        leads,
        stages: [...stages].sort((x, y) => boardIds.indexOf(x.boardId) - boardIds.indexOf(y.boardId) || x.position - y.position),
        names,
        from,
        to,
        now,
        timeZone: timeZoneOf(query.tz),
      }),
    };
  }

  /** O título de cada lead (a coluna do título da secção; sem ela, a chave de A numa unida). */
  async leadTitles(board: LeadBoardRecord, rowKeys: string[]) {
    const fallback = (rowKey: string) => rowKey.split('|')[0] || rowKey;
    const titles = new Map(rowKeys.map((k) => [k, fallback(k)]));
    if (!board.titleColumn || !rowKeys.length) return titles;
    try {
      const read = await this.data.readSource(board.companyId, sourceOf(board), true, { limit: 0, extraRefs: rowKeys });
      for (const row of read.extra) {
        const value = row.values[board.titleColumn];
        if (value !== null && value !== undefined && value !== '') titles.set(row.ref, String(value));
      }
    } catch {
      // A origem mudou: fica a chave
    }
    return titles;
  }

  // ── comentários na tabela de dados ──

  /** Quantos comentários tem cada linha de uma tabela ou unida (somando as secções que a usam). */
  async rowCommentCounts(userId: string, companyId: string, query: RowCommentsQueryDto) {
    await this.access(userId, companyId, 'leads.view');
    const source = query.sourceType === 'table' ? { tableId: query.sourceId } : { viewId: query.sourceId };
    const counts = new Map<string, number>();
    for (const lead of await this.repository.countCommentsByRow(companyId, source)) counts.set(lead.rowKey, (counts.get(lead.rowKey) ?? 0) + lead._count.comments);
    return Object.fromEntries(counts);
  }

  /** Os comentários de uma linha, de todas as secções que a usam (só de leitura). */
  async rowComments(userId: string, companyId: string, query: RowCommentsQueryDto & { row: string }) {
    await this.access(userId, companyId, 'leads.view');
    const source = query.sourceType === 'table' ? { tableId: query.sourceId } : { viewId: query.sourceId };
    const comments = await this.repository.findCommentsOfRow(companyId, source, query.row);
    const names = new Map((await this.repository.findUserNames([...new Set(comments.map((c) => c.userId))])).map((u) => [u.id, u.fullName]));
    return comments.map((c) => ({
      id: c.id,
      body: c.body,
      userName: names.get(c.userId) ?? null,
      mine: c.userId === userId,
      createdAt: c.createdAt,
      editedAt: c.editedAt,
      boardId: c.lead.board.id,
      boardName: c.lead.board.name,
    }));
  }
}
