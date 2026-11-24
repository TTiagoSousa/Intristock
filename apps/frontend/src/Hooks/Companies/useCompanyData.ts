import { useCallback, useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { getErrorMessage } from '../useAsyncRequest';

// Os dados de uma empresa (módulo call center): as tabelas feitas à mão (de um ficheiro ou escritas na
// app), as importações e as tabelas unidas (A ⋈ B pelas colunas escolhidas, calculadas ao ler).

export const DATA_COLUMN_TYPES = ['text', 'number', 'date', 'money', 'phone', 'email'] as const;
export type Data_Column_Type = (typeof DATA_COLUMN_TYPES)[number];

export const DATA_NORMALIZE = ['trim', 'lower', 'digits', 'firstToken'] as const;
export type Data_Normalize = (typeof DATA_NORMALIZE)[number];

export const DATA_JOIN_TYPES = ['inner', 'left', 'full'] as const;
export type Data_Join_Type = (typeof DATA_JOIN_TYPES)[number];

export const DATA_VIEW_FILTERS = ['all', 'matched', 'leftOnly', 'rightOnly', 'duplicates'] as const;
export type Data_View_Filter = (typeof DATA_VIEW_FILTERS)[number];

/** O que o backend põe no lugar de um dado pessoal a quem não tem `data.personal`. */
export const MASKED = '•••';

export type Data_Value = string | number | null;

export interface Data_Column {
  key: string;
  label: string;
  type: Data_Column_Type;
  personal: boolean;
  hidden: boolean;
  sourceHeader?: string | null;
}

export interface Data_Table {
  id: string;
  name: string;
  /// `api`: a que uma ligação (Shopify) enche
  source: 'file' | 'manual' | 'api';
  columns: Data_Column[];
  keyColumn: string | null;
  rowCount: number;
  lastImportAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Data_Table_Detail extends Data_Table {
  importConfig: { mapping: Record<string, string>; skipTotals: boolean } | null;
}

export interface Data_Row {
  id: string;
  key: string | null;
  data: Record<string, Data_Value>;
  updatedAt: string;
}

/** Um filtro por coluna das linhas: todos têm de bater (o backend valida-os, `rowFilters.ts`). */
export const DATA_FILTER_OPS = ['contains', 'equals', 'not', 'empty', 'notEmpty', 'gt', 'gte', 'lt', 'lte', 'in'] as const;
export type Data_Filter_Op = (typeof DATA_FILTER_OPS)[number];

export interface Data_Row_Filter {
  column: string;
  op: Data_Filter_Op;
  value?: string;
  /// «É um de»: os valores escolhidos da lista da coluna ("" = vazio)
  values?: string[];
}

export const filtersParam = (filters: Data_Row_Filter[]) => (filters.length ? JSON.stringify(filters) : undefined);

/** Os valores de uma coluna com quantas linhas tem cada um ("" = vazio); `truncated`: há mais do que os da lista. */
export interface Data_Column_Values {
  column: string;
  values: { value: string; count: number }[];
  truncated: boolean;
}

export interface Data_Rows_Page {
  rows: Data_Row[];
  total: number;
  page: number;
  take: number;
  personalVisible: boolean;
}

export interface Data_Import {
  id: string;
  fileName: string;
  status: 'done' | 'failed';
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: { row: number; message: string }[] | null;
  createdAt: string;
}

export interface Data_File_Preview {
  fileName: string;
  headers: string[];
  columns: { header: string; type: Data_Column_Type; samples: string[] }[];
  rows: Data_Value[][];
  totalRows: number;
  totalsRowDetected: boolean;
}

export interface Data_Join_Pair {
  left: string;
  right: string;
  normalize: Data_Normalize[];
}

export interface Data_View_Column {
  side: 'left' | 'right';
  column: string;
  label: string;
}

export interface Data_View {
  id: string;
  name: string;
  leftTableId: string;
  rightTableId: string;
  leftTable: { id: string; name: string };
  rightTable: { id: string; name: string };
  joinOn: Data_Join_Pair[];
  joinType: Data_Join_Type;
  columns: Data_View_Column[];
  createdAt: string;
  updatedAt: string;
}

export type Data_View_Input = Pick<Data_View, 'leftTableId' | 'rightTableId' | 'joinOn' | 'joinType' | 'columns'>;

export interface Data_View_Stats {
  matched: number;
  leftOnly: number;
  rightOnly: number;
  duplicates: number;
  leftRows: number;
  rightRows: number;
}

export interface Data_View_Result {
  columns: { key: string; label: string; side: 'left' | 'right'; type: Data_Column_Type; personal: boolean }[];
  /// `ref`: a linha, «<linha A>|<linha B>» (a das Leads)
  rows: { ref?: string; match: 'matched' | 'leftOnly' | 'rightOnly'; duplicate: boolean; values: Record<string, Data_Value> }[];
  stats: Data_View_Stats;
}

export interface Data_View_Page extends Data_View_Result {
  personalVisible: boolean;
  total: number;
  page: number;
  take: number;
}

const path = (companyId: string, rest: string) => End_Points.Company_Data_Endpoint(companyId, rest);

/** Um GET que se volta a pedir com `reload`; os dados de outra chave não aparecem na nova. */
export const useResource = <T,>(url: string | null, params: Record<string, unknown>) => {
  const key = JSON.stringify(params);
  const id = url ? `${url}?${key}` : null;
  const [state, setState] = useState<{ id: string; url: string; data: T | null; error: string | null } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!url || !id) return;
    let cancelled = false;
    http
      .get<T>(url, { params: JSON.parse(key) })
      .then((response) => {
        if (!cancelled) setState({ id, url, data: response.data, error: null });
      })
      .catch((reason) => {
        if (!cancelled)
          setState((previous) => ({
            id,
            url,
            data: previous?.id === id ? previous.data : null,
            error: getErrorMessage(reason),
          }));
      });
    return () => {
      cancelled = true;
    };
  }, [url, key, id, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const current = state && state.id === id ? state : null;
  // Outra página ou outro filtro do mesmo pedido: as linhas de antes ficam à vista até chegarem as novas
  const previous = !current && state && state.url === url ? state.data : null;
  return { data: current?.data ?? previous ?? null, error: current?.error ?? null, reload };
};

export const useDataTables = (companyId: string | undefined) =>
  useResource<Data_Table[]>(companyId ? path(companyId, 'tables') : null, {});

export const useDataTable = (companyId: string | undefined, tableId: string | undefined) =>
  useResource<Data_Table_Detail>(companyId && tableId ? path(companyId, `tables/${tableId}`) : null, {});

export const useDataRows = (
  companyId: string | undefined,
  tableId: string | undefined,
  query: { page: number; take: number; search: string; filters: Data_Row_Filter[] },
) =>
  useResource<Data_Rows_Page>(companyId && tableId ? path(companyId, `tables/${tableId}/rows`) : null, {
    page: query.page,
    take: query.take,
    search: query.search.trim() || undefined,
    filters: filtersParam(query.filters),
  });

export const useDataImports = (companyId: string | undefined, tableId: string | undefined) =>
  useResource<Data_Import[]>(companyId && tableId ? path(companyId, `tables/${tableId}/imports`) : null, {});

export const useDataViews = (companyId: string | undefined) =>
  useResource<Data_View[]>(companyId ? path(companyId, 'views') : null, {});

export const useDataView = (companyId: string | undefined, viewId: string | undefined) =>
  useResource<Data_View>(companyId && viewId ? path(companyId, `views/${viewId}`) : null, {});

export const useDataViewRows = (
  companyId: string | undefined,
  viewId: string | undefined,
  query: { page: number; take: number; search: string; only: Data_View_Filter; filters: Data_Row_Filter[] },
) =>
  useResource<Data_View_Page>(companyId && viewId ? path(companyId, `views/${viewId}/rows`) : null, {
    page: query.page,
    take: query.take,
    search: query.search.trim() || undefined,
    only: query.only === 'all' ? undefined : query.only,
    filters: filtersParam(query.filters),
  });

/**
 * Os valores de uma coluna (para o «é um de»), nas linhas da pesquisa e dos outros filtros:
 * `source` é `tables/<id>` ou `views/<id>`; nulo não pede.
 */
export const useDataColumnValues = (
  companyId: string | undefined,
  source: string | null,
  query: { column: string; q: string; search: string; only?: Data_View_Filter; filters: Data_Row_Filter[] },
) =>
  useResource<Data_Column_Values>(companyId && source && query.column ? path(companyId, `${source}/values`) : null, {
    column: query.column,
    q: query.q.trim() || undefined,
    search: query.search.trim() || undefined,
    only: !query.only || query.only === 'all' ? undefined : query.only,
    filters: filtersParam(query.filters),
  });

const fileForm = (file: File, extra: Record<string, string> = {}) => {
  const form = new FormData();
  form.append('file', file);
  for (const [name, value] of Object.entries(extra)) form.append(name, value);
  return form;
};

// As escritas: devolvem a resposta ou atiram o erro (o ecrã mostra-o)
/** Um campo de uma API que se leva para uma coluna (as encomendas da Shopify). */
export interface Data_Connection_Field {
  field: string;
  label: string;
  type: Data_Column_Type;
  personal: boolean;
}

/** Uma ligação a uma API que enche uma tabela pela coluna chave (a chave nunca volta ao browser). */
export interface Data_Connection {
  id: string;
  provider: 'shopify';
  shop: string;
  tableId: string;
  tableName: string | null;
  mapping: Record<string, string>;
  status: 'active' | 'error' | 'paused';
  syncEveryHours: 1 | 24 | 168;
  cursor: string | null;
  lastError: string | null;
  syncedAt: string | null;
  createdAt: string;
  syncing?: boolean;
}

export const useDataConnections = (companyId: string | undefined) =>
  useResource<Data_Connection[]>(companyId ? path(companyId, 'connections') : null, {});

export const useDataConnectionFields = (companyId: string | undefined) =>
  useResource<{ shopify: Data_Connection_Field[] }>(companyId ? path(companyId, 'connections/fields') : null, {});

export const dataConnectionsApi = {
  check: (companyId: string, body: { provider: 'shopify'; shop: string; token: string }) =>
    http.post<{ name: string; currencyCode: string }>(path(companyId, 'connections/check'), body).then((r) => r.data),
  create: (
    companyId: string,
    body: {
      provider: 'shopify';
      shop: string;
      token: string;
      tableId?: string;
      newTableName?: string;
      fields?: string[];
      mapping?: Record<string, string>;
      syncEveryHours?: number;
    },
  ) => http.post<Data_Connection>(path(companyId, 'connections'), body).then((r) => r.data),
  update: (companyId: string, id: string, body: { status?: 'active' | 'paused'; syncEveryHours?: number; mapping?: Record<string, string>; token?: string }) =>
    http.patch<Data_Connection>(path(companyId, `connections/${id}`), body).then((r) => r.data),
  remove: (companyId: string, id: string) => http.delete(path(companyId, `connections/${id}`)),
  sync: (companyId: string, id: string) =>
    http.post<{ created: number; updated: number; unchanged: number; orders: number }>(path(companyId, `connections/${id}/sync`), {}).then((r) => r.data),
};

export const dataApi = {
  preview: (companyId: string, file: File) =>
    http.post<Data_File_Preview>(path(companyId, 'preview'), fileForm(file)).then((response) => response.data),
  createTable: (
    companyId: string,
    body: { name: string; source: 'file' | 'manual'; columns: Data_Column[]; keyColumn: string | null },
  ) => http.post<Data_Table>(path(companyId, 'tables'), body).then((response) => response.data),
  updateTable: (
    companyId: string,
    tableId: string,
    body: { name?: string; columns?: Data_Column[]; keyColumn?: string | null },
  ) => http.patch<Data_Table>(path(companyId, `tables/${tableId}`), body).then((response) => response.data),
  deleteTable: (companyId: string, tableId: string) => http.delete(path(companyId, `tables/${tableId}`)),
  importFile: (companyId: string, tableId: string, file: File, mapping: Record<string, string>, skipTotals: boolean) =>
    http
      .post<Data_Import>(
        path(companyId, `tables/${tableId}/import`),
        fileForm(file, { mapping: JSON.stringify(mapping), skipTotals: String(skipTotals) }),
      )
      .then((response) => response.data),
  createRow: (companyId: string, tableId: string, data: Record<string, Data_Value>) =>
    http.post<Data_Row>(path(companyId, `tables/${tableId}/rows`), { data }).then((response) => response.data),
  updateRow: (companyId: string, tableId: string, rowId: string, data: Record<string, Data_Value>) =>
    http.patch<Data_Row>(path(companyId, `tables/${tableId}/rows/${rowId}`), { data }).then((response) => response.data),
  deleteRow: (companyId: string, tableId: string, rowId: string) =>
    http.delete(path(companyId, `tables/${tableId}/rows/${rowId}`)),
  previewView: (companyId: string, body: Data_View_Input) =>
    http.post<Data_View_Result>(path(companyId, 'views/preview'), body).then((response) => response.data),
  createView: (companyId: string, body: Data_View_Input & { name: string }) =>
    http.post<Data_View>(path(companyId, 'views'), body).then((response) => response.data),
  updateView: (companyId: string, viewId: string, body: Data_View_Input & { name: string }) =>
    http.patch<Data_View>(path(companyId, `views/${viewId}`), body).then((response) => response.data),
  deleteView: (companyId: string, viewId: string) => http.delete(path(companyId, `views/${viewId}`)),
};
