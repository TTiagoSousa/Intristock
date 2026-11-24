import { SourceColumn, SourceRow } from 'src/company-data/company-data.service';
import { LeadRecord, LeadRuleRecord, PrismaCompanyLeadRepository } from '../repositories/prisma/prisma-company-lead-repository';
import { compileRules, pickRule } from './leadRules';

/**
 * Corre as automações da secção nas leads dela, com os dados de agora (as linhas que passam os filtros e as das leads
 * que já lá estavam, sem •••): cada lead, a primeira que se aplica. Atribuir vai dando as leads aos operadores da
 * lista, um de cada vez. Devolve quantas se aplicaram.
 */
export async function applyLeadRules(
  repository: PrismaCompanyLeadRepository,
  input: { leads: LeadRecord[]; rules: LeadRuleRecord[]; columns: SourceColumn[]; rows: SourceRow[]; now?: Date },
) {
  const rules = compileRules(input.rules, input.columns);
  if (!rules.length) return 0;
  const now = input.now ?? new Date();
  const values = new Map(input.rows.map((row) => [row.ref, row.values]));
  const endOf = new Map<string, number>();
  const cursorOf = new Map(rules.map((r) => [r.id, r.assignCursor ?? 0]));
  let applied = 0;

  for (const lead of input.leads) {
    const row = values.get(lead.rowKey);
    if (!row) continue;
    const rule = pickRule(lead, row, rules, now);
    if (!rule) continue;

    if (rule.action === 'archive') {
      if (await repository.applyRule(lead.id, rule.id, { archivedAt: now }, { kind: 'archived', ruleId: rule.id })) applied++;
      continue;
    }
    if (rule.action === 'assign') {
      const people = rule.assigneeIds ?? [];
      const cursor = cursorOf.get(rule.id)! % people.length;
      if (await repository.applyAssignRule(lead.id, rule.id, people[cursor], (cursor + 1) % people.length)) {
        cursorOf.set(rule.id, cursor + 1);
        applied++;
      }
      continue;
    }
    // No fim da coluna para onde vai
    const stageId = rule.stageId!;
    if (!endOf.has(stageId)) endOf.set(stageId, (await repository.lastPositionInStage(stageId)) ?? 0);
    const position = endOf.get(stageId)! + 1;
    endOf.set(stageId, position);
    const done = await repository.applyRule(
      lead.id,
      rule.id,
      { stageId, position, movedByRuleId: rule.id, stageEnteredAt: now },
      { kind: 'moved', ruleId: rule.id, fromStageId: lead.stageId, toStageId: stageId },
    );
    if (done) applied++;
  }
  return applied;
}
