import { BadRequestException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client/client';
import { SourceColumn } from 'src/company-data/company-data.service';
import { LeadBoardRecord, LeadRuleRecord, LeadStageRecord, PrismaCompanyLeadRepository } from '../repositories/prisma/prisma-company-lead-repository';
import { assertLeadRule, LeadRuleInput, MAX_RULES } from './leadRules';

/** Uma automação nova, no fim da lista. */
export async function createLeadRule(
  repository: PrismaCompanyLeadRepository,
  board: LeadBoardRecord,
  stages: LeadStageRecord[],
  userId: string,
  input: LeadRuleInput & { name: string; action: string },
  columns: SourceColumn[],
  people: Set<string>,
) {
  const rules = await repository.findRules(board.id);
  if (rules.length >= MAX_RULES) throw new BadRequestException(`No máximo ${MAX_RULES} automações por secção`);
  const rule = assertLeadRule(input, columns, new Set(stages.map((s) => s.id)), people);
  return repository.createRule({
    boardId: board.id,
    ...rule,
    conditions: rule.conditions as Prisma.InputJsonValue,
    leadConditions: rule.leadConditions as unknown as Prisma.InputJsonValue,
    enabled: input.enabled ?? true,
    position: Math.max(-1, ...rules.map((r) => r.position)) + 1,
    createdById: userId,
  });
}

/** Muda uma automação (o que vem no pedido, o resto fica) ou o lugar dela na lista. */
export async function updateLeadRule(
  repository: PrismaCompanyLeadRepository,
  rules: LeadRuleRecord[],
  rule: LeadRuleRecord,
  stages: LeadStageRecord[],
  input: LeadRuleInput & { position?: number },
  columns: SourceColumn[],
  people: Set<string>,
) {
  const merged = assertLeadRule(
    {
      name: input.name ?? rule.name,
      conditions: input.conditions ?? rule.conditions,
      fromStageIds: input.fromStageIds ?? rule.fromStageIds,
      action: input.action ?? rule.action,
      stageId: input.stageId !== undefined ? input.stageId : rule.stageId,
      leadConditions: input.leadConditions ?? rule.leadConditions,
      assigneeIds: input.assigneeIds ?? rule.assigneeIds,
    },
    columns,
    new Set(stages.map((s) => s.id)),
    people,
  );
  const sameAssignees = merged.assigneeIds.join() === rule.assigneeIds.join();
  await repository.updateRule(rule.id, {
    ...merged,
    conditions: merged.conditions as Prisma.InputJsonValue,
    leadConditions: merged.leadConditions as unknown as Prisma.InputJsonValue,
    // Outra lista de operadores começa outra vez pelo primeiro
    ...(sameAssignees ? {} : { assignCursor: 0 }),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
  });

  if (input.position !== undefined) {
    const order = rules.filter((r) => r.id !== rule.id);
    order.splice(Math.max(0, Math.min(input.position, order.length)), 0, rule);
    await repository.transaction(async (tx) => {
      for (const [index, r] of order.entries()) if (r.position !== index) await repository.updateRule(r.id, { position: index }, tx);
    });
  }
  return repository.findRules(rule.boardId);
}
