import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'src/generated/prisma/client/client';

type Tx = Prisma.TransactionClient;

const BOARD_VIEW = {
  id: true,
  companyId: true,
  name: true,
  sourceType: true,
  tableId: true,
  viewId: true,
  filters: true,
  search: true,
  only: true,
  phoneColumn: true,
  titleColumn: true,
  cardColumns: true,
  position: true,
  archived: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CompanyLeadBoardSelect;

const STAGE_VIEW = { id: true, boardId: true, name: true, position: true, isEntry: true, cardLimit: true } satisfies Prisma.CompanyLeadStageSelect;

const LEAD_VIEW = {
  id: true,
  boardId: true,
  rowKey: true,
  stageId: true,
  position: true,
  assignedToId: true,
  archivedAt: true,
  appliedRuleIds: true,
  movedByRuleId: true,
  assignedAt: true,
  callbackAt: true,
  callbackNote: true,
  attempts: true,
  lastCallAt: true,
  lastOutcomeId: true,
  stageEnteredAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { comments: true } },
} satisfies Prisma.CompanyLeadSelect;

const OUTCOME_VIEW = {
  id: true,
  boardId: true,
  name: true,
  stageId: true,
  answered: true,
  countsAsAttempt: true,
  asksCallback: true,
  position: true,
} satisfies Prisma.CompanyLeadOutcomeSelect;

const RULE_VIEW = {
  id: true,
  boardId: true,
  name: true,
  conditions: true,
  fromStageIds: true,
  leadConditions: true,
  action: true,
  assigneeIds: true,
  assignCursor: true,
  stageId: true,
  enabled: true,
  position: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CompanyLeadRuleSelect;

@Injectable()
export class PrismaCompanyLeadRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(fn: (tx: Tx) => Promise<T>, options?: { timeout?: number }) {
    return this.prisma.$transaction(fn, options);
  }

  // ── secções ──

  findBoards(companyId: string) {
    return this.prisma.companyLeadBoard.findMany({
      where: { companyId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { ...BOARD_VIEW, table: { select: { name: true } }, view: { select: { name: true } } },
    });
  }

  findBoard(id: string) {
    return this.prisma.companyLeadBoard.findUnique({ where: { id }, select: BOARD_VIEW });
  }

  async nextBoardPosition(companyId: string) {
    const last = await this.prisma.companyLeadBoard.aggregate({ where: { companyId }, _max: { position: true } });
    return (last._max.position ?? -1) + 1;
  }

  createBoard(tx: Tx, data: Prisma.CompanyLeadBoardUncheckedCreateInput) {
    return tx.companyLeadBoard.create({ data, select: BOARD_VIEW });
  }

  updateBoard(id: string, data: Prisma.CompanyLeadBoardUncheckedUpdateInput) {
    return this.prisma.companyLeadBoard.update({ where: { id }, data, select: BOARD_VIEW });
  }

  async deleteBoard(id: string) {
    await this.prisma.companyLeadBoard.delete({ where: { id } });
  }

  // ── colunas do quadro ──

  findStages(boardId: string, tx?: Tx) {
    return (tx ?? this.prisma).companyLeadStage.findMany({ where: { boardId }, orderBy: { position: 'asc' }, select: STAGE_VIEW });
  }

  createStages(tx: Tx, data: Prisma.CompanyLeadStageCreateManyInput[]) {
    return tx.companyLeadStage.createMany({ data });
  }

  createStage(data: Prisma.CompanyLeadStageUncheckedCreateInput) {
    return this.prisma.companyLeadStage.create({ data, select: STAGE_VIEW });
  }

  updateStage(id: string, data: Prisma.CompanyLeadStageUncheckedUpdateInput, tx?: Tx) {
    return (tx ?? this.prisma).companyLeadStage.update({ where: { id }, data, select: STAGE_VIEW });
  }

  countLeadsInStage(stageId: string, archived: boolean) {
    return this.prisma.companyLead.count({ where: { stageId, archivedAt: archived ? { not: null } : null } });
  }

  async deleteStage(stageId: string, moveArchivedTo: string) {
    await this.prisma.$transaction([
      this.prisma.companyLead.updateMany({ where: { stageId }, data: { stageId: moveArchivedTo } }),
      this.prisma.companyLeadStage.delete({ where: { id: stageId } }),
    ]);
  }

  // ── leads ──

  findLeads(boardId: string) {
    return this.prisma.companyLead.findMany({ where: { boardId }, select: LEAD_VIEW });
  }

  findLead(boardId: string, rowKey: string, tx?: Tx) {
    return (tx ?? this.prisma).companyLead.findUnique({ where: { boardId_rowKey: { boardId, rowKey } }, select: LEAD_VIEW });
  }

  createLead(tx: Tx, data: Prisma.CompanyLeadUncheckedCreateInput) {
    return tx.companyLead.create({ data, select: LEAD_VIEW });
  }

  updateLead(tx: Tx, id: string, data: Prisma.CompanyLeadUncheckedUpdateInput) {
    return tx.companyLead.update({ where: { id }, data, select: LEAD_VIEW });
  }

  createEvent(tx: Tx, data: Prisma.CompanyLeadEventUncheckedCreateInput) {
    return tx.companyLeadEvent.create({ data });
  }

  findEvents(leadId: string) {
    return this.prisma.companyLeadEvent.findMany({ where: { leadId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  /** As linhas que passam os filtros e ainda não têm lead: entram na coluna de entrada (as que já há ficam). */
  async createMissingLeads(boardId: string, stageId: string, rows: { rowKey: string; position: number }[]) {
    if (!rows.length) return 0;
    const result = await this.prisma.companyLead.createMany({
      data: rows.map((r) => ({ boardId, stageId, rowKey: r.rowKey, position: r.position })),
      skipDuplicates: true,
    });
    return result.count;
  }

  /**
   * Uma automação numa lead, só se ainda não se lhe aplicou (dois pedidos ao mesmo tempo não a aplicam duas vezes):
   * devolve se aplicou.
   */
  async applyRule(
    leadId: string,
    ruleId: string,
    data: Prisma.CompanyLeadUncheckedUpdateManyInput,
    event: Omit<Prisma.CompanyLeadEventUncheckedCreateInput, 'leadId'>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.companyLead.updateMany({
        where: { id: leadId, NOT: { appliedRuleIds: { has: ruleId } } },
        data: { ...data, appliedRuleIds: { push: ruleId } },
      });
      if (!updated.count) return false;
      await tx.companyLeadEvent.create({ data: { ...event, leadId } });
      return true;
    });
  }

  async lastPositionInStage(stageId: string) {
    const last = await this.prisma.companyLead.aggregate({ where: { stageId }, _max: { position: true } });
    return last._max.position;
  }

  // ── automações ──

  findRules(boardId: string) {
    return this.prisma.companyLeadRule.findMany({ where: { boardId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: RULE_VIEW });
  }

  createRule(data: Prisma.CompanyLeadRuleUncheckedCreateInput) {
    return this.prisma.companyLeadRule.create({ data, select: RULE_VIEW });
  }

  updateRule(id: string, data: Prisma.CompanyLeadRuleUncheckedUpdateInput, tx?: Tx) {
    return (tx ?? this.prisma).companyLeadRule.update({ where: { id }, data, select: RULE_VIEW });
  }

  async deleteRule(id: string) {
    await this.prisma.companyLeadRule.delete({ where: { id } });
  }

  /** Atribuir numa automação: só se ainda não se lhe aplicou, e a vez passa ao seguinte (na mesma transação). */
  async applyAssignRule(leadId: string, ruleId: string, assignedToId: string, cursor: number) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.companyLead.updateMany({
        where: { id: leadId, NOT: { appliedRuleIds: { has: ruleId } } },
        data: { assignedToId, assignedAt: new Date(), appliedRuleIds: { push: ruleId } },
      });
      if (!updated.count) return false;
      await tx.companyLeadRule.update({ where: { id: ruleId }, data: { assignCursor: cursor } });
      await tx.companyLeadEvent.create({ data: { leadId, ruleId, kind: 'assigned' } });
      return true;
    });
  }

  // ── resultados das chamadas ──

  findOutcomes(boardId: string, tx?: Tx) {
    return (tx ?? this.prisma).companyLeadOutcome.findMany({ where: { boardId }, orderBy: [{ position: 'asc' }, { name: 'asc' }], select: OUTCOME_VIEW });
  }

  createOutcomes(tx: Tx, data: Prisma.CompanyLeadOutcomeCreateManyInput[]) {
    return tx.companyLeadOutcome.createMany({ data });
  }

  createOutcome(data: Prisma.CompanyLeadOutcomeUncheckedCreateInput) {
    return this.prisma.companyLeadOutcome.create({ data, select: OUTCOME_VIEW });
  }

  updateOutcome(id: string, data: Prisma.CompanyLeadOutcomeUncheckedUpdateInput, tx?: Tx) {
    return (tx ?? this.prisma).companyLeadOutcome.update({ where: { id }, data, select: OUTCOME_VIEW });
  }

  async deleteOutcome(id: string) {
    await this.prisma.companyLeadOutcome.delete({ where: { id } });
  }

  createCall(tx: Tx, data: Prisma.CompanyLeadCallUncheckedCreateInput) {
    return tx.companyLeadCall.create({ data });
  }

  findCalls(leadId: string) {
    return this.prisma.companyLeadCall.findMany({ where: { leadId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  // ── dashboard ──

  findCallsBetween(boardIds: string[], from: Date, to: Date) {
    return this.prisma.companyLeadCall.findMany({
      where: { boardId: { in: boardIds }, createdAt: { gte: from, lt: to } },
      select: { boardId: true, leadId: true, userId: true, outcomeName: true, answered: true, createdAt: true },
    });
  }

  findMovesBetween(boardIds: string[], from: Date, to: Date) {
    return this.prisma.companyLeadEvent.findMany({
      where: { kind: 'moved', lead: { boardId: { in: boardIds } }, createdAt: { gte: from, lt: to } },
      select: { leadId: true, fromStageId: true, toStageId: true, createdAt: true, userId: true, ruleId: true },
    });
  }

  /** As leads de várias secções, sem os comentários (para o dashboard). */
  findLeadsOf(boardIds: string[]) {
    return this.prisma.companyLead.findMany({
      where: { boardId: { in: boardIds } },
      select: { id: true, boardId: true, stageId: true, archivedAt: true, assignedToId: true, callbackAt: true, stageEnteredAt: true, createdAt: true },
    });
  }

  findStagesOf(boardIds: string[]) {
    return this.prisma.companyLeadStage.findMany({ where: { boardId: { in: boardIds } }, orderBy: { position: 'asc' }, select: STAGE_VIEW });
  }

  // ── em fundo ──

  /** As secções com automações ligadas (de todas as empresas), para correrem sem ninguém abrir o quadro. */
  findBoardsWithRules() {
    return this.prisma.companyLeadBoard.findMany({
      where: { archived: false, rules: { some: { enabled: true } } },
      select: BOARD_VIEW,
    });
  }

  /** As leads com o voltar a ligar já na hora e com alguém atribuído (para o aviso). */
  findDueCallbacks(now: Date) {
    return this.prisma.companyLead.findMany({
      where: { callbackAt: { lte: now }, assignedToId: { not: null }, archivedAt: null },
      select: {
        id: true,
        rowKey: true,
        callbackAt: true,
        callbackNote: true,
        assignedToId: true,
        board: { select: { ...BOARD_VIEW, company: { select: { id: true, slug: true } } } },
      },
      take: 500,
    });
  }

  /** Os avisos já mandados para estes voltar a ligar (a chave é a lead + a hora). */
  async findSentCallbackKeys(keys: string[]) {
    if (!keys.length) return new Set<string>();
    const rows = await this.prisma.notification.findMany({
      where: { kind: 'lead_callback_due', OR: keys.map((key) => ({ data: { path: ['callbackKey'], equals: key } })) },
      select: { data: true },
    });
    return new Set(rows.map((r) => (r.data as { callbackKey?: string }).callbackKey ?? ''));
  }

  // ── comentários na tabela de dados ──

  /** Quantos comentários tem cada linha de uma origem, somando as secções que a usam. */
  async countCommentsByRow(companyId: string, source: { tableId?: string; viewId?: string }) {
    const leads = await this.prisma.companyLead.findMany({
      where: { board: { companyId, ...(source.tableId ? { tableId: source.tableId } : { viewId: source.viewId }) }, comments: { some: {} } },
      select: { rowKey: true, boardId: true, _count: { select: { comments: true } } },
    });
    return leads;
  }

  findCommentsOfRow(companyId: string, source: { tableId?: string; viewId?: string }, rowKey: string) {
    return this.prisma.companyLeadComment.findMany({
      where: { lead: { rowKey, board: { companyId, ...(source.tableId ? { tableId: source.tableId } : { viewId: source.viewId }) } } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, body: true, userId: true, createdAt: true, editedAt: true, lead: { select: { board: { select: { id: true, name: true } } } } },
    });
  }

  // ── comentários ──

  findComments(leadId: string) {
    return this.prisma.companyLeadComment.findMany({ where: { leadId }, orderBy: { createdAt: 'asc' } });
  }

  findComment(id: string) {
    return this.prisma.companyLeadComment.findUnique({ where: { id }, include: { lead: { select: { boardId: true } } } });
  }

  createComment(tx: Tx, data: Prisma.CompanyLeadCommentUncheckedCreateInput) {
    return tx.companyLeadComment.create({ data });
  }

  updateComment(id: string, body: string) {
    return this.prisma.companyLeadComment.update({ where: { id }, data: { body, editedAt: new Date() } });
  }

  async deleteComment(id: string) {
    await this.prisma.companyLeadComment.delete({ where: { id } });
  }

  // ── quem ──

  async findUserNames(ids: string[]): Promise<{ id: string; fullName: string }[]> {
    if (!ids.length) return [];
    return this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
  }
}

export type LeadBoardRecord = NonNullable<Awaited<ReturnType<PrismaCompanyLeadRepository['findBoard']>>>;
export type LeadStageRecord = Awaited<ReturnType<PrismaCompanyLeadRepository['findStages']>>[number];
export type LeadRecord = Awaited<ReturnType<PrismaCompanyLeadRepository['findLeads']>>[number];
export type LeadOutcomeRecord = Awaited<ReturnType<PrismaCompanyLeadRepository['findOutcomes']>>[number];
export type LeadRuleRecord = Awaited<ReturnType<PrismaCompanyLeadRepository['findRules']>>[number];
