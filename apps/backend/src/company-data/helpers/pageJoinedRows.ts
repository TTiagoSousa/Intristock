import { MASK } from './dataTypes';
import { JoinedRow, JoinResult } from './joinTables';
import { matchesRowFilter, parseRowFilters } from './rowFilters';

export const VIEW_FILTERS = ['all', 'matched', 'leftOnly', 'rightOnly', 'duplicates'] as const;
export type ViewFilter = (typeof VIEW_FILTERS)[number];

/**
 * As linhas da tabela unida que passam o filtro (com par, só de um lado, repetidas), a
 * pesquisa e os filtros por coluna — só nas colunas que quem pede vê —, sem os da
 * `skipColumn` (a lista dos valores dessa coluna não se filtra a si própria). Com `filtersAsOwner` os filtros
 * valem também nas colunas pessoais (os de uma secção das Leads, que quem a gere escolheu).
 */
export function filterJoinedRows(
  result: JoinResult,
  canSeePersonal: boolean,
  query: { search?: string; only?: ViewFilter; filters?: string; skipColumn?: string; filtersAsOwner?: boolean },
) {
  const searchable = result.columns.filter((c) => canSeePersonal || !c.personal).map((c) => c.key);
  const term = query.search?.trim().toLocaleLowerCase('pt-PT');
  const only = query.only ?? 'all';
  const filters = parseRowFilters(query.filters, result.columns, canSeePersonal || query.filtersAsOwner === true).filter((f) => f.column !== query.skipColumn);

  const keep = (row: JoinedRow) => {
    if (only === 'duplicates' ? !row.duplicate : only !== 'all' && row.match !== only) return false;
    if (!filters.every((filter) => matchesRowFilter(row.values[filter.column], filter))) return false;
    if (!term) return true;
    return searchable.some((key) => {
      const v = row.values[key];
      return v !== null && v !== undefined && String(v).toLocaleLowerCase('pt-PT').includes(term);
    });
  };

  return result.rows.filter(keep);
}

/** Uma página da tabela unida (`filterJoinedRows`), com as colunas pessoais em ••• para quem não as vê. */
export function pageJoinedRows(
  result: JoinResult,
  canSeePersonal: boolean,
  query: { page: number; take: number; search?: string; only?: ViewFilter; filters?: string },
) {
  const personal = result.columns.filter((c) => c.personal).map((c) => c.key);
  const filtered = filterJoinedRows(result, canSeePersonal, query);
  const start = (query.page - 1) * query.take;
  const rows = filtered.slice(start, start + query.take).map((row) => {
    if (canSeePersonal) return row;
    const values = { ...row.values };
    for (const key of personal) if (values[key] !== null && values[key] !== undefined) values[key] = MASK;
    return { ...row, values };
  });

  return { columns: result.columns, rows, personalVisible: canSeePersonal, total: filtered.length, page: query.page, take: query.take, stats: result.stats };
}
