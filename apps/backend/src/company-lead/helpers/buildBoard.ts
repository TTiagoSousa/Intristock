import { SourceRow } from 'src/company-data/company-data.service';
import { CellValue } from 'src/company-data/helpers/dataTypes';
import { UNTOUCHED_POSITION } from './leadTypes';

export interface BoardStage {
  id: string;
  name: string;
  position: number;
  isEntry: boolean;
  cardLimit?: number | null;
}

export interface BoardLead {
  id: string;
  rowKey: string;
  stageId: string;
  position: number;
  archivedAt: Date | null;
  updatedAt: Date;
  comments: number;
  /// A automação que a pôs na coluna em que está (fica à vista mesmo fora do filtro)
  movedByRuleId?: string | null;
  assignedToId?: string | null;
  callbackAt?: Date | null;
  callbackNote?: string | null;
  attempts?: number;
  lastOutcomeId?: string | null;
  stageEnteredAt?: Date;
}

export interface BoardCard {
  rowKey: string;
  leadId: string | null;
  stageId: string;
  position: number;
  /// Já não passa os filtros da secção (fica para não se perder o trabalho; arquiva-se no fim)
  outOfFilter: boolean;
  /// A linha já não existe na origem
  missing: boolean;
  archived: boolean;
  /// O nome da automação que a pôs nesta coluna
  byRule: string | null;
  values: Record<string, CellValue>;
  comments: number;
  updatedAt: string | null;
  assignedToId: string | null;
  /// Quando voltar a ligar (e a nota)
  callbackAt: string | null;
  callbackNote: string | null;
  attempts: number;
  /// O nome do resultado da última chamada
  lastOutcome: string | null;
  /// Desde quando está na coluna (os dias na coluna)
  stageEnteredAt: string | null;
}

/**
 * Os cartões de um quadro: cada linha que passa os filtros, na coluna da lead (ou na de entrada, se ninguém lhe
 * mexeu). Uma lead que deixa de passar (a encomenda foi entregue) sai do quadro, esteja em que coluna estiver: fica
 * guardada e conta em `left` (com `showLeft` vem marcada, e volta ao sítio dela se passar outra vez). As arquivadas
 * também não vêm (com `showArchived` sim, marcadas). Com a lista cortada (`truncated`) não se sabe se uma lead que
 * não veio passa, por isso fica.
 */
export function buildBoard(input: {
  stages: BoardStage[];
  leads: BoardLead[];
  rows: SourceRow[];
  extra: SourceRow[];
  truncated: boolean;
  keep: string[];
  showArchived?: boolean;
  showLeft?: boolean;
  ruleNames?: Map<string, string>;
  outcomeNames?: Map<string, string>;
}) {
  const leadFields = (lead: BoardLead | undefined) => ({
    assignedToId: lead?.assignedToId ?? null,
    callbackAt: lead?.callbackAt ? lead.callbackAt.toISOString() : null,
    callbackNote: lead?.callbackNote ?? null,
    attempts: lead?.attempts ?? 0,
    lastOutcome: lead?.lastOutcomeId ? (input.outcomeNames?.get(lead.lastOutcomeId) ?? null) : null,
    stageEnteredAt: lead?.stageEnteredAt ? lead.stageEnteredAt.toISOString() : null,
  });
  const ruleOf = (lead: BoardLead | undefined) => (lead?.movedByRuleId ? (input.ruleNames?.get(lead.movedByRuleId) ?? null) : null);
  const hidden = (lead: BoardLead | undefined) => Boolean(lead?.archivedAt) && !input.showArchived;
  const entry = input.stages.find((s) => s.isEntry) ?? input.stages[0];
  const stageIds = new Set(input.stages.map((s) => s.id));
  const byRef = new Map(input.leads.map((l) => [l.rowKey, l]));
  const pick = (values: Record<string, CellValue>) => Object.fromEntries(input.keep.map((k) => [k, values[k] ?? null]));

  const cards: BoardCard[] = [];
  const seen = new Set<string>();
  input.rows.forEach((row, index) => {
    seen.add(row.ref);
    const lead = byRef.get(row.ref);
    if (hidden(lead)) return;
    cards.push({
      rowKey: row.ref,
      leadId: lead?.id ?? null,
      stageId: lead && stageIds.has(lead.stageId) ? lead.stageId : entry.id,
      position: lead ? lead.position : UNTOUCHED_POSITION + index,
      outOfFilter: false,
      missing: false,
      archived: Boolean(lead?.archivedAt),
      byRule: ruleOf(lead),
      values: pick(row.values),
      comments: lead?.comments ?? 0,
      updatedAt: lead ? lead.updatedAt.toISOString() : null,
      ...leadFields(lead),
    });
  });

  const extra = new Map(input.extra.map((r) => [r.ref, r]));
  let left = 0;
  for (const lead of input.leads) {
    if (seen.has(lead.rowKey) || !stageIds.has(lead.stageId)) continue;
    const row = extra.get(lead.rowKey);
    // Com a lista cortada, uma que existe pode passar (só não coube): fica como está
    const out = !input.truncated || !row;
    // Uma que uma automação pôs numa coluna fica lá à vista (a regra é que a mantém)
    const kept = Boolean(ruleOf(lead));
    if (out && !lead.archivedAt && !kept) left++;
    if (hidden(lead) || (out && !lead.archivedAt && !kept && !input.showLeft)) continue;
    cards.push({
      rowKey: lead.rowKey,
      leadId: lead.id,
      stageId: lead.stageId,
      position: lead.position,
      outOfFilter: out,
      missing: !row,
      archived: Boolean(lead.archivedAt),
      byRule: ruleOf(lead),
      values: row ? pick(row.values) : {},
      comments: lead.comments,
      updatedAt: lead.updatedAt.toISOString(),
      ...leadFields(lead),
    });
  }

  cards.sort((a, b) => a.position - b.position);
  const counts = new Map<string, number>();
  for (const card of cards) if (!card.archived && (!card.outOfFilter || card.byRule)) counts.set(card.stageId, (counts.get(card.stageId) ?? 0) + 1);

  return {
    stages: input.stages.map((s) => ({ ...s, count: counts.get(s.id) ?? 0 })),
    cards,
    archived: input.leads.filter((l) => l.archivedAt).length,
    left,
  };
}
