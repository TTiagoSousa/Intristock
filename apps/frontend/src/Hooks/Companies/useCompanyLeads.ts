import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useResource, type Data_Column_Type, type Data_Row_Filter, type Data_Value, type Data_View_Filter } from './useCompanyData';

// As Leads do call center: secções (quadros) com as linhas de uma tabela ou tabela unida que passam os filtros,
// em colunas («Por ligar», «1.ª chamada»…). Cada lead (uma linha) muda de coluna, tem comentários e o histórico.

export type Lead_Source_Type = 'table' | 'view';

export interface Lead_Board_Settings {
  filters: Data_Row_Filter[];
  search: string | null;
  only: Data_View_Filter | null;
  phoneColumn: string | null;
  titleColumn: string | null;
  cardColumns: string[];
}

export interface Lead_Board extends Lead_Board_Settings {
  id: string;
  name: string;
  sourceType: Lead_Source_Type;
  tableId: string | null;
  viewId: string | null;
  sourceName: string | null;
  position: number;
  archived: boolean;
  updatedAt: string;
}

export interface Lead_Source_Column {
  key: string;
  label: string;
  type: Data_Column_Type;
  personal: boolean;
  side?: 'left' | 'right';
}

export interface Lead_Stage {
  id: string;
  name: string;
  position: number;
  isEntry: boolean;
  /// Quantos cartões se mostram de início (nulo = todos)
  cardLimit: number | null;
  count: number;
}

/** Um botão de resultado de uma chamada (definido em cada secção). */
export interface Lead_Outcome {
  id: string;
  name: string;
  stageId: string | null;
  answered: boolean;
  countsAsAttempt: boolean;
  asksCallback: boolean;
  position: number;
}

export interface Lead_Person {
  id: string;
  name: string;
}

export interface Lead_Card {
  rowKey: string;
  leadId: string | null;
  stageId: string;
  position: number;
  /// Já não passa os filtros (a encomenda mudou de estado); fica até se arquivar
  outOfFilter: boolean;
  missing: boolean;
  archived: boolean;
  /// O nome da automação que a pôs nesta coluna (fica à vista mesmo fora do filtro)
  byRule: string | null;
  values: Record<string, Data_Value>;
  comments: number;
  updatedAt: string | null;
  assignedToId: string | null;
  callbackAt: string | null;
  callbackNote: string | null;
  attempts: number;
  lastOutcome: string | null;
  stageEnteredAt: string | null;
}

export interface Lead_Board_Detail {
  board: Lead_Board & { sourceId: string };
  columns: Lead_Source_Column[];
  personalVisible: boolean;
  stages: Lead_Stage[];
  cards: Lead_Card[];
  archived: number;
  /// As que deixaram de passar os filtros (a encomenda foi entregue): saem do quadro, ficam guardadas
  left: number;
  total: number;
  truncated: boolean;
  /// A origem mudou (uma coluna dos filtros saiu): o quadro abre vazio, com o motivo
  error: string | null;
  outcomes: Lead_Outcome[];
  /// Quem pode ficar com leads (o dono e quem trabalha nelas)
  people: Lead_Person[];
  me: string;
}

export interface Lead_Comment {
  id: string;
  body: string;
  userName: string | null;
  mine: boolean;
  createdAt: string;
  editedAt: string | null;
}

export interface Lead_Event {
  id: string;
  kind: 'moved' | 'archived' | 'restored' | 'assigned' | 'unassigned' | 'callback' | 'callback_cleared' | 'called';
  userName: string | null;
  /// Feito por uma automação (o nome dela, se ainda existir)
  byRule: boolean;
  ruleName: string | null;
  from: string | null;
  to: string | null;
  /// Numa chamada: o resultado e se atendeu
  outcome: string | null;
  answered: boolean | null;
  createdAt: string;
}

export interface Lead_Detail {
  rowKey: string;
  missing: boolean;
  columns: Lead_Source_Column[];
  values: Record<string, Data_Value>;
  personalVisible: boolean;
  lead: {
    id: string;
    stageId: string;
    archived: boolean;
    byRule: string | null;
    createdAt: string;
    updatedAt: string;
    assignedToId: string | null;
    assignedName: string | null;
    callbackAt: string | null;
    callbackNote: string | null;
    attempts: number;
    lastCallAt: string | null;
    lastOutcome: string | null;
    stageEnteredAt: string;
  } | null;
  comments: Lead_Comment[];
  events: Lead_Event[];
}

export type Lead_Board_Input = Partial<Lead_Board_Settings> & {
  name?: string;
  sourceType?: Lead_Source_Type;
  sourceId?: string;
  position?: number;
};

export type Lead_Rule_Action = 'move' | 'archive' | 'assign';

export type Lead_Condition_Field = 'attempts' | 'daysInStage' | 'assigned' | 'callbackDue';
/** Uma condição sobre a própria lead (não sobre a linha). */
export interface Lead_Condition {
  field: Lead_Condition_Field;
  /// Nos números gte | lte | eq; no «assigned» empty | notEmpty; no «callbackDue» yes | no
  op: string;
  value?: number;
}

/** Uma automação de uma secção: quando os dados da lead batem nas condições, move-a ou arquiva-a (uma vez por lead). */
export interface Lead_Rule {
  id: string;
  name: string;
  conditions: Data_Row_Filter[];
  /// Só quando a lead está numa destas colunas (vazio = em qualquer uma)
  fromStageIds: string[];
  action: Lead_Rule_Action;
  stageId: string | null;
  leadConditions: Lead_Condition[];
  /// No «assign»: a quem, pela ordem
  assigneeIds: string[];
  enabled: boolean;
  position: number;
}

export type Lead_Rule_Input = Partial<Omit<Lead_Rule, 'id'>>;

const path = (companyId: string, rest: string) => End_Points.Company_Leads_Endpoint(companyId, rest);

export const useLeadRules = (companyId: string | undefined, boardId: string | undefined) =>
  useResource<Lead_Rule[]>(companyId && boardId ? path(companyId, `boards/${boardId}/rules`) : null, {});

export const useLeadBoards = (companyId: string | undefined) =>
  useResource<Lead_Board[]>(companyId ? path(companyId, 'boards') : null, {});

export const useLeadBoard = (companyId: string | undefined, boardId: string | undefined, show: { archived: boolean; left: boolean }) =>
  useResource<Lead_Board_Detail>(companyId && boardId ? path(companyId, `boards/${boardId}`) : null, {
    archived: show.archived ? 'true' : undefined,
    left: show.left ? 'true' : undefined,
  });

export const useLeadDetail = (companyId: string | undefined, boardId: string | undefined, rowKey: string | null) =>
  useResource<Lead_Detail>(companyId && boardId && rowKey ? path(companyId, `boards/${boardId}/lead`) : null, { row: rowKey ?? undefined });

export interface Lead_Dashboard {
  from: string;
  to: string;
  boards: { id: string; name: string }[];
  cards: {
    calls: number;
    answered: number;
    answerRate: number | null;
    leadsCalled: number;
    open: number;
    unassigned: number;
    callbacksToday: number;
    callbacksOverdue: number;
  };
  byDay: { day: string; calls: number; answered: number }[];
  byUser: { userId: string; name: string | null; calls: number; answered: number; answerRate: number | null; leads: number }[];
  byOutcome: { name: string; count: number }[];
  stages: { id: string; boardId: string; name: string; now: number; avgDaysNow: number | null; avgDaysToLeave: number | null; entered: number }[];
}

export const useLeadDashboard = (companyId: string | undefined, query: { from: string; to: string; boardId?: string; tz: string }) =>
  useResource<Lead_Dashboard>(companyId ? path(companyId, 'dashboard') : null, query);

export interface Lead_Row_Comment extends Lead_Comment {
  boardId: string;
  boardName: string;
}

export const useRowCommentCounts = (companyId: string | undefined, sourceType: Lead_Source_Type, sourceId: string | undefined) =>
  useResource<Record<string, number>>(companyId && sourceId ? path(companyId, 'row-comments/counts') : null, { sourceType, sourceId });

export const useRowComments = (companyId: string | undefined, sourceType: Lead_Source_Type, sourceId: string | undefined, row: string | null) =>
  useResource<Lead_Row_Comment[]>(companyId && sourceId && row ? path(companyId, 'row-comments') : null, { sourceType, sourceId, row: row ?? undefined });

export type Lead_Outcome_Input = Partial<Omit<Lead_Outcome, 'id'>>;
export type Lead_Bulk_Action = 'move' | 'archive' | 'restore' | 'assign';

// As escritas: devolvem a resposta ou atiram o erro (o ecrã mostra-o)
export const leadsApi = {
  createBoard: (companyId: string, body: Lead_Board_Input & { name: string; sourceType: Lead_Source_Type; sourceId: string }) =>
    http.post<Lead_Board>(path(companyId, 'boards'), body).then((r) => r.data),
  updateBoard: (companyId: string, boardId: string, body: Lead_Board_Input) =>
    http.patch<Lead_Board>(path(companyId, `boards/${boardId}`), body).then((r) => r.data),
  deleteBoard: (companyId: string, boardId: string) => http.delete(path(companyId, `boards/${boardId}`)),
  createStage: (companyId: string, boardId: string, name: string) =>
    http.post(path(companyId, `boards/${boardId}/stages`), { name }).then((r) => r.data),
  updateStage: (companyId: string, boardId: string, stageId: string, body: { name?: string; position?: number; cardLimit?: number | null }) =>
    http.patch(path(companyId, `boards/${boardId}/stages/${stageId}`), body).then((r) => r.data),
  createRule: (companyId: string, boardId: string, body: Lead_Rule_Input & { name: string; action: Lead_Rule_Action }) =>
    http.post<Lead_Rule>(path(companyId, `boards/${boardId}/rules`), body).then((r) => r.data),
  updateRule: (companyId: string, boardId: string, ruleId: string, body: Lead_Rule_Input) =>
    http.patch<Lead_Rule[]>(path(companyId, `boards/${boardId}/rules/${ruleId}`), body).then((r) => r.data),
  deleteRule: (companyId: string, boardId: string, ruleId: string) => http.delete(path(companyId, `boards/${boardId}/rules/${ruleId}`)),
  deleteStage: (companyId: string, boardId: string, stageId: string) => http.delete(path(companyId, `boards/${boardId}/stages/${stageId}`)),
  move: (companyId: string, boardId: string, body: { rowKey: string; stageId: string; position: number; from?: number }) =>
    http.post(path(companyId, `boards/${boardId}/move`), body).then((r) => r.data),
  archive: (companyId: string, boardId: string, body: { rowKey: string; archived: boolean; position?: number }) =>
    http.post(path(companyId, `boards/${boardId}/archive`), body).then((r) => r.data),
  addComment: (companyId: string, boardId: string, body: { rowKey: string; body: string; position?: number }) =>
    http.post<Lead_Comment>(path(companyId, `boards/${boardId}/comments`), body).then((r) => r.data),
  editComment: (companyId: string, boardId: string, commentId: string, body: string) =>
    http.patch(path(companyId, `boards/${boardId}/comments/${commentId}`), { body }).then((r) => r.data),
  deleteComment: (companyId: string, boardId: string, commentId: string) =>
    http.delete(path(companyId, `boards/${boardId}/comments/${commentId}`)),
  assign: (companyId: string, boardId: string, body: { rowKey: string; assignedToId: string | null; position?: number }) =>
    http.post(path(companyId, `boards/${boardId}/assign`), body).then((r) => r.data),
  callback: (companyId: string, boardId: string, body: { rowKey: string; callbackAt: string | null; note?: string | null; position?: number }) =>
    http.post(path(companyId, `boards/${boardId}/callback`), body).then((r) => r.data),
  logCall: (
    companyId: string,
    boardId: string,
    body: { rowKey: string; outcomeId: string; callbackAt?: string | null; callbackNote?: string | null; comment?: string | null; position?: number },
  ) => http.post(path(companyId, `boards/${boardId}/calls`), body).then((r) => r.data),
  bulk: (
    companyId: string,
    boardId: string,
    body: { rows: { rowKey: string; position?: number }[]; action: Lead_Bulk_Action; stageId?: string | null; assignedToId?: string | null },
  ) => http.post<{ changed: number }>(path(companyId, `boards/${boardId}/bulk`), body).then((r) => r.data),
  createOutcome: (companyId: string, boardId: string, body: Lead_Outcome_Input & { name: string }) =>
    http.post<Lead_Outcome>(path(companyId, `boards/${boardId}/outcomes`), body).then((r) => r.data),
  updateOutcome: (companyId: string, boardId: string, outcomeId: string, body: Lead_Outcome_Input) =>
    http.patch<Lead_Outcome[]>(path(companyId, `boards/${boardId}/outcomes/${outcomeId}`), body).then((r) => r.data),
  deleteOutcome: (companyId: string, boardId: string, outcomeId: string) => http.delete(path(companyId, `boards/${boardId}/outcomes/${outcomeId}`)),
};

