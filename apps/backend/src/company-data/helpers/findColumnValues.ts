import { DataTableRecord, PrismaCompanyDataRepository } from '../repositories/prisma/prisma-company-data-repository';
import { DataColumn } from './dataTypes';
import { assertValuesColumn, MAX_COLUMN_VALUES, parseRowFilters } from './rowFilters';

/**
 * Os valores de uma coluna de uma tabela, com quantas linhas tem cada um: nas linhas da
 * pesquisa e dos outros filtros (os da própria coluna não contam, como no Excel).
 */
export async function findColumnValues(
  repository: PrismaCompanyDataRepository,
  table: DataTableRecord,
  canSeePersonal: boolean,
  query: { column: string; q?: string; search?: string; filters?: string },
) {
  const columns = table.columns as unknown as DataColumn[];
  const column = assertValuesColumn(columns, query.column, canSeePersonal);
  const filters = parseRowFilters(query.filters, columns, canSeePersonal).filter((f) => f.column !== column.key);
  const found = await repository.findColumnValues(table.id, {
    column: column.key,
    q: query.q,
    search: query.search,
    searchKeys: columns.filter((c) => canSeePersonal || !c.personal).map((c) => c.key),
    filters,
    limit: MAX_COLUMN_VALUES + 1,
  });
  return { column: column.key, values: found.slice(0, MAX_COLUMN_VALUES), truncated: found.length > MAX_COLUMN_VALUES };
}
