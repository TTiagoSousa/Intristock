import { JoinResult } from './joinTables';
import { filterJoinedRows, ViewFilter } from './pageJoinedRows';
import { assertValuesColumn, filterText, MAX_COLUMN_VALUES } from './rowFilters';

/**
 * Os valores de uma coluna da tabela unida, com quantas linhas tem cada um: nas linhas
 * do filtro (com par, só de um lado…), da pesquisa e dos outros filtros. Juntam-se como
 * no SQL das tabelas (sem maiúsculas nem espaços à volta; as vazias em "").
 */
export function joinedColumnValues(
  result: JoinResult,
  canSeePersonal: boolean,
  query: { column: string; q?: string; search?: string; only?: ViewFilter; filters?: string },
) {
  const column = assertValuesColumn(result.columns, query.column, canSeePersonal);
  const rows = filterJoinedRows(result, canSeePersonal, { ...query, skipColumn: column.key });
  const q = query.q?.trim().toLocaleLowerCase('pt-PT');
  const counts = new Map<string, { value: string; count: number }>();
  for (const row of rows) {
    const raw = row.values[column.key];
    const value = raw === null || raw === undefined ? '' : String(raw).trim();
    if (q && !value.toLocaleLowerCase('pt-PT').includes(q)) continue;
    const key = filterText(value);
    const entry = counts.get(key);
    if (!entry) counts.set(key, { value, count: 1 });
    else {
      entry.count += 1;
      if (value < entry.value) entry.value = value;
    }
  }
  const sorted = [...counts.values()].sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
  return { column: column.key, values: sorted.slice(0, MAX_COLUMN_VALUES), truncated: sorted.length > MAX_COLUMN_VALUES };
}
