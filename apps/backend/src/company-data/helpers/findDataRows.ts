import { DataTableRecord, PrismaCompanyDataRepository } from '../repositories/prisma/prisma-company-data-repository';
import { DataColumn } from './dataTypes';
import { maskRow } from './maskRow';
import { parseRowFilters } from './rowFilters';

/** As linhas às páginas, com a pesquisa e os filtros (só nas colunas que quem pede vê) e as pessoais escondidas. */
export async function findDataRows(
  repository: PrismaCompanyDataRepository,
  table: DataTableRecord,
  canSeePersonal: boolean,
  query: { page: number; take: number; search?: string; filters?: string },
) {
  const columns = table.columns as unknown as DataColumn[];
  const searchKeys = columns.filter((c) => canSeePersonal || !c.personal).map((c) => c.key);
  const { rows, total } = await repository.findRows(table.id, {
    skip: (query.page - 1) * query.take,
    take: query.take,
    search: query.search,
    searchKeys,
    filters: parseRowFilters(query.filters, columns, canSeePersonal),
  });

  return {
    rows: rows.map((r) => ({ ...r, data: canSeePersonal ? r.data : maskRow(r.data, columns) })),
    total,
    page: query.page,
    take: query.take,
    personalVisible: canSeePersonal,
  };
}
