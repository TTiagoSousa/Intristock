import { SourceColumn, SourceRow } from 'src/company-data/company-data.service';
import { LeadBoardRecord, LeadStageRecord, PrismaCompanyLeadRepository } from '../repositories/prisma/prisma-company-lead-repository';

/** Uma lead para a barra lateral: a linha toda, os comentários e o histórico, com o nome de quem. */
export async function findLeadDetail(
  repository: PrismaCompanyLeadRepository,
  board: LeadBoardRecord,
  stages: LeadStageRecord[],
  userId: string,
  input: { rowKey: string; columns: SourceColumn[]; row: SourceRow | null; ruleNames: Map<string, string>; outcomeNames: Map<string, string> },
) {
  const lead = await repository.findLead(board.id, input.rowKey);
  type Comments = Awaited<ReturnType<PrismaCompanyLeadRepository['findComments']>>;
  type Events = Awaited<ReturnType<PrismaCompanyLeadRepository['findEvents']>>;
  type Calls = Awaited<ReturnType<PrismaCompanyLeadRepository['findCalls']>>;
  const [comments, events, calls]: [Comments, Events, Calls] = lead
    ? await Promise.all([repository.findComments(lead.id), repository.findEvents(lead.id), repository.findCalls(lead.id)])
    : [[], [], []];
  const users = await repository.findUserNames(
    [...new Set([...comments.map((c) => c.userId), ...events.map((e) => e.userId), ...calls.map((c) => c.userId), lead?.assignedToId])].filter(
      (id): id is string => Boolean(id),
    ),
  );
  const nameOf = new Map(users.map((u) => [u.id, u.fullName]));
  const stageName = new Map(stages.map((s) => [s.id, s.name]));

  return {
    rowKey: input.rowKey,
    missing: !input.row,
    columns: input.columns,
    values: input.row?.values ?? {},
    lead: lead
      ? {
          id: lead.id,
          stageId: lead.stageId,
          archived: Boolean(lead.archivedAt),
          byRule: lead.movedByRuleId ? (input.ruleNames.get(lead.movedByRuleId) ?? null) : null,
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt,
          assignedToId: lead.assignedToId,
          assignedName: lead.assignedToId ? (nameOf.get(lead.assignedToId) ?? null) : null,
          callbackAt: lead.callbackAt,
          callbackNote: lead.callbackNote,
          attempts: lead.attempts,
          lastCallAt: lead.lastCallAt,
          lastOutcome: lead.lastOutcomeId ? (input.outcomeNames.get(lead.lastOutcomeId) ?? null) : null,
          stageEnteredAt: lead.stageEnteredAt,
        }
      : null,
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      userName: nameOf.get(c.userId) ?? null,
      mine: c.userId === userId,
      createdAt: c.createdAt,
      editedAt: c.editedAt,
    })),
    // O histórico junta as mudanças e as chamadas (cada chamada com o resultado), do mais recente para trás
    events: [
      ...events.map((e) => ({
        id: e.id,
        kind: e.kind,
        userName: e.userId ? (nameOf.get(e.userId) ?? null) : null,
        ruleName: e.ruleId ? (input.ruleNames.get(e.ruleId) ?? null) : null,
        byRule: Boolean(e.ruleId),
        from: e.fromStageId ? (stageName.get(e.fromStageId) ?? null) : null,
        to: e.toStageId ? (stageName.get(e.toStageId) ?? null) : null,
        outcome: null as string | null,
        answered: null as boolean | null,
        createdAt: e.createdAt,
      })),
      ...calls.map((c) => ({
        id: c.id,
        kind: 'called',
        userName: nameOf.get(c.userId) ?? null,
        ruleName: null,
        byRule: false,
        from: null,
        to: null,
        outcome: c.outcomeName,
        answered: c.answered,
        createdAt: c.createdAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  };
}
