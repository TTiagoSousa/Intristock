/** As contas do dashboard do call center: chamadas, atendimento, operadores, resultados e o tempo em cada coluna. */

export interface SummaryCall {
  boardId: string;
  leadId: string;
  userId: string;
  outcomeName: string;
  answered: boolean;
  createdAt: Date;
}

export interface SummaryMove {
  leadId: string;
  fromStageId: string | null;
  toStageId: string | null;
  createdAt: Date;
}

export interface SummaryLead {
  id: string;
  boardId: string;
  stageId: string;
  archivedAt: Date | null;
  assignedToId: string | null;
  callbackAt: Date | null;
  stageEnteredAt: Date;
  createdAt: Date;
}

export interface SummaryStage {
  id: string;
  boardId: string;
  name: string;
  position: number;
}

const DAY_MS = 86_400_000;

/** O dia local (YYYY-MM-DD) de uma data no fuso dado. */
export function localDay(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const nextDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
};

const rate = (part: number, total: number) => (total ? part / total : null);
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

export function summarizeLeads(input: {
  calls: SummaryCall[];
  /// As mudanças de coluna até ao fim do período (as de antes servem para saber desde quando lá estava)
  moves: SummaryMove[];
  leads: SummaryLead[];
  stages: SummaryStage[];
  names: Map<string, string>;
  from: Date;
  to: Date;
  now: Date;
  timeZone: string;
}) {
  const { calls, from, to, now, timeZone } = input;

  // Um ponto por dia, também os sem chamadas
  const byDay = new Map<string, { calls: number; answered: number }>();
  const last = localDay(new Date(to.getTime() - 1), timeZone);
  for (let day = localDay(from, timeZone); day <= last; day = nextDay(day)) byDay.set(day, { calls: 0, answered: 0 });
  const byUser = new Map<string, { calls: number; answered: number; leads: Set<string> }>();
  const byOutcome = new Map<string, number>();
  for (const call of calls) {
    const day = byDay.get(localDay(call.createdAt, timeZone));
    if (day) {
      day.calls++;
      if (call.answered) day.answered++;
    }
    const user = byUser.get(call.userId) ?? { calls: 0, answered: 0, leads: new Set<string>() };
    user.calls++;
    if (call.answered) user.answered++;
    user.leads.add(call.leadId);
    byUser.set(call.userId, user);
    byOutcome.set(call.outcomeName, (byOutcome.get(call.outcomeName) ?? 0) + 1);
  }

  // O tempo em cada coluna: de quando a lead entrou nela até sair (as saídas do período)
  const leadById = new Map(input.leads.map((l) => [l.id, l]));
  const movesOf = new Map<string, SummaryMove[]>();
  for (const move of [...input.moves].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const list = movesOf.get(move.leadId) ?? [];
    list.push(move);
    movesOf.set(move.leadId, list);
  }
  const exits = new Map<string, number[]>();
  const entries = new Map<string, number>();
  for (const [leadId, list] of movesOf) {
    let enteredAt = leadById.get(leadId)?.createdAt ?? null;
    for (const move of list) {
      const inPeriod = move.createdAt >= from && move.createdAt < to;
      if (inPeriod && move.fromStageId && enteredAt) {
        const days = (move.createdAt.getTime() - enteredAt.getTime()) / DAY_MS;
        exits.set(move.fromStageId, [...(exits.get(move.fromStageId) ?? []), Math.max(0, days)]);
      }
      if (inPeriod && move.toStageId) entries.set(move.toStageId, (entries.get(move.toStageId) ?? 0) + 1);
      enteredAt = move.createdAt;
    }
  }

  const open = input.leads.filter((l) => !l.archivedAt);
  const todayEnd = localDay(now, timeZone);
  const callbacks = open.filter((l) => l.callbackAt);
  const overdue = callbacks.filter((l) => l.callbackAt! < now).length;
  const today = callbacks.filter((l) => l.callbackAt! >= now && localDay(l.callbackAt!, timeZone) === todayEnd).length;

  const answered = calls.filter((c) => c.answered).length;
  return {
    cards: {
      calls: calls.length,
      answered,
      answerRate: rate(answered, calls.length),
      leadsCalled: new Set(calls.map((c) => c.leadId)).size,
      open: open.length,
      unassigned: open.filter((l) => !l.assignedToId).length,
      callbacksToday: today,
      callbacksOverdue: overdue,
    },
    byDay: [...byDay].map(([day, v]) => ({ day, ...v })),
    byUser: [...byUser]
      .map(([userId, v]) => ({
        userId,
        name: input.names.get(userId) ?? null,
        calls: v.calls,
        answered: v.answered,
        answerRate: rate(v.answered, v.calls),
        leads: v.leads.size,
      }))
      .sort((a, b) => b.calls - a.calls),
    byOutcome: [...byOutcome].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    stages: input.stages.map((stage) => {
      const here = open.filter((l) => l.stageId === stage.id);
      return {
        id: stage.id,
        boardId: stage.boardId,
        name: stage.name,
        now: here.length,
        // Há quanto tempo, em média, as que lá estão agora
        avgDaysNow: mean(here.map((l) => (now.getTime() - l.stageEnteredAt.getTime()) / DAY_MS)),
        // Quanto tempo ficaram as que saíram no período
        avgDaysToLeave: mean(exits.get(stage.id) ?? []),
        entered: entries.get(stage.id) ?? 0,
      };
    }),
  };
}
