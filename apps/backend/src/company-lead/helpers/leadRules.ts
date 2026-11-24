import { BadRequestException } from '@nestjs/common';
import { SourceColumn } from 'src/company-data/company-data.service';
import { CellValue } from 'src/company-data/helpers/dataTypes';
import { matchesRowFilter, parseRowFilters, RowFilter } from 'src/company-data/helpers/rowFilters';

/** As automações de uma secção: quando os dados da lead batem nas condições, move-a ou arquiva-a (uma vez por lead). */
export const LEAD_RULE_ACTIONS = ['move', 'archive', 'assign'] as const;
export type LeadRuleAction = (typeof LEAD_RULE_ACTIONS)[number];
export const MAX_RULES = 20;
export const MAX_ASSIGNEES = 30;

/**
 * As condições sobre a própria lead (não sobre a linha): as tentativas, os dias na coluna, se tem alguém e se já
 * passou a hora de voltar a ligar.
 */
export const LEAD_CONDITION_FIELDS = ['attempts', 'daysInStage', 'assigned', 'callbackDue'] as const;
export type LeadConditionField = (typeof LEAD_CONDITION_FIELDS)[number];
export interface LeadCondition {
  field: LeadConditionField;
  /// Nos números: gte | lte | eq; no «assigned»: empty | notEmpty; no «callbackDue»: yes | no
  op: string;
  value?: number;
}
const LEAD_CONDITION_OPS: Record<LeadConditionField, string[]> = {
  attempts: ['gte', 'lte', 'eq'],
  daysInStage: ['gte', 'lte', 'eq'],
  assigned: ['empty', 'notEmpty'],
  callbackDue: ['yes', 'no'],
};
export const MAX_LEAD_CONDITIONS = 5;

/** O que as condições da lead precisam dela. */
export interface LeadState {
  stageId: string;
  appliedRuleIds: string[];
  archivedAt: Date | null;
  attempts?: number;
  stageEnteredAt?: Date;
  assignedToId?: string | null;
  callbackAt?: Date | null;
}

const DAY_MS = 86_400_000;

export function matchesLeadCondition(lead: LeadState, condition: LeadCondition, now: Date) {
  const compare = (n: number) =>
    condition.op === 'gte' ? n >= (condition.value ?? 0) : condition.op === 'lte' ? n <= (condition.value ?? 0) : n === (condition.value ?? 0);
  switch (condition.field) {
    case 'attempts':
      return compare(lead.attempts ?? 0);
    case 'daysInStage':
      return compare(Math.floor((now.getTime() - (lead.stageEnteredAt ?? now).getTime()) / DAY_MS));
    case 'assigned':
      return condition.op === 'empty' ? !lead.assignedToId : Boolean(lead.assignedToId);
    case 'callbackDue': {
      const due = Boolean(lead.callbackAt && lead.callbackAt.getTime() <= now.getTime());
      return condition.op === 'yes' ? due : !due;
    }
  }
}

/** Valida as condições sobre a lead (o formato; sem nenhuma, uma lista vazia). */
export function parseLeadConditions(raw: unknown): LeadCondition[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new BadRequestException('As condições da lead não são uma lista');
  if (raw.length > MAX_LEAD_CONDITIONS) throw new BadRequestException(`No máximo ${MAX_LEAD_CONDITIONS} condições sobre a lead`);
  return raw.map((item) => {
    const c = (item ?? {}) as Partial<LeadCondition>;
    if (!LEAD_CONDITION_FIELDS.includes(c.field as LeadConditionField)) throw new BadRequestException('Condição da lead desconhecida');
    const field = c.field as LeadConditionField;
    if (!c.op || !LEAD_CONDITION_OPS[field].includes(c.op)) throw new BadRequestException('Operador da condição da lead desconhecido');
    if (field === 'attempts' || field === 'daysInStage') {
      const value = Number(c.value);
      if (!Number.isInteger(value) || value < 0 || value > 10_000) throw new BadRequestException('O número da condição da lead não é válido');
      return { field, op: c.op, value };
    }
    return { field, op: c.op };
  });
}

export interface RuleLike {
  id: string;
  name: string;
  conditions: unknown;
  fromStageIds: string[];
  action: string;
  stageId: string | null;
  enabled: boolean;
  leadConditions?: unknown;
  assigneeIds?: string[];
  assignCursor?: number;
}

export interface CompiledRule extends RuleLike {
  filters: RowFilter[];
  lead: LeadCondition[];
}

/**
 * As automações prontas a correr, pela ordem: só as ligadas e com o que precisam (a coluna do «mover»); as que já não
 * servem à origem (uma coluna saiu) ficam de fora em vez de partir o quadro.
 */
export function compileRules(rules: RuleLike[], columns: SourceColumn[]): CompiledRule[] {
  const out: CompiledRule[] = [];
  for (const rule of rules) {
    if (!rule.enabled || (rule.action === 'move' && !rule.stageId) || (rule.action === 'assign' && !rule.assigneeIds?.length)) continue;
    try {
      const filters = parseRowFilters(JSON.stringify(rule.conditions ?? []), columns, true);
      const lead = parseLeadConditions(rule.leadConditions);
      if (filters.length || lead.length) out.push({ ...rule, filters, lead });
    } catch {
      // A origem mudou e a regra já não bate com ela: não corre (as definições mostram-na)
    }
  }
  return out;
}

/**
 * A primeira automação que se aplica a uma lead agora: ainda não se aplicou a ela, a lead está numa das colunas da
 * regra (sem nenhuma, em qualquer uma) e os dados batem em todas as condições. Mover para a coluna em que já está não
 * conta. Uma arquivada não se mexe.
 */
export function pickRule(lead: LeadState, values: Record<string, CellValue>, rules: CompiledRule[], now = new Date()): CompiledRule | null {
  if (lead.archivedAt) return null;
  for (const rule of rules) {
    if (lead.appliedRuleIds.includes(rule.id)) continue;
    if (rule.fromStageIds.length && !rule.fromStageIds.includes(lead.stageId)) continue;
    if (rule.action === 'move' && rule.stageId === lead.stageId) continue;
    // Atribuir não tira a lead a quem já a tem
    if (rule.action === 'assign' && lead.assignedToId) continue;
    if (!rule.lead.every((condition) => matchesLeadCondition(lead, condition, now))) continue;
    if (rule.filters.every((filter) => matchesRowFilter(values[filter.column], filter))) return rule;
  }
  return null;
}

export interface LeadRuleInput {
  name?: string;
  conditions?: unknown;
  fromStageIds?: unknown;
  action?: string;
  stageId?: string | null;
  enabled?: boolean;
  leadConditions?: unknown;
  assigneeIds?: unknown;
}

/** Valida uma automação contra as colunas da origem e as do quadro. */
export function assertLeadRule(
  input: Required<Pick<LeadRuleInput, 'name' | 'action'>> & LeadRuleInput,
  columns: SourceColumn[],
  stageIds: Set<string>,
  people: Set<string> = new Set(),
) {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new BadRequestException('A automação precisa de um nome');

  const conditions = input.conditions ?? [];
  if (!Array.isArray(conditions)) throw new BadRequestException('As condições não são uma lista');
  parseRowFilters(JSON.stringify(conditions), columns, true);
  const leadConditions = parseLeadConditions(input.leadConditions);
  if (conditions.length === 0 && leadConditions.length === 0) throw new BadRequestException('A automação precisa de pelo menos uma condição');

  const fromStageIds = input.fromStageIds ?? [];
  if (!Array.isArray(fromStageIds) || fromStageIds.some((id) => typeof id !== 'string' || !stageIds.has(id))) {
    throw new BadRequestException('Uma das colunas «só quando está em» não é desta secção');
  }

  if (!LEAD_RULE_ACTIONS.includes(input.action as LeadRuleAction)) throw new BadRequestException('Ação desconhecida');
  const stageId = input.action === 'move' ? (input.stageId ?? null) : null;
  if (input.action === 'move' && (!stageId || !stageIds.has(stageId))) throw new BadRequestException('Escolhe a coluna para onde a lead vai');

  let assigneeIds: string[] = [];
  if (input.action === 'assign') {
    const raw = input.assigneeIds ?? [];
    if (!Array.isArray(raw) || raw.some((id) => typeof id !== 'string')) throw new BadRequestException('Os operadores não são uma lista');
    assigneeIds = [...new Set(raw as string[])];
    if (!assigneeIds.length) throw new BadRequestException('Escolhe a quem se atribuem as leads');
    if (assigneeIds.length > MAX_ASSIGNEES) throw new BadRequestException(`No máximo ${MAX_ASSIGNEES} operadores`);
    if (assigneeIds.some((id) => !people.has(id))) throw new BadRequestException('Um dos operadores não trabalha nas leads desta empresa');
  }

  return { name, conditions, leadConditions, fromStageIds: [...new Set(fromStageIds as string[])], action: input.action, stageId, assigneeIds };
}
