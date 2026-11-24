import { DataTableRecord, PrismaCompanyDataRepository } from '../repositories/prisma/prisma-company-data-repository';
import { DataColumn, RowData } from './dataTypes';
import { ViewDefinition } from './assertViewDefinition';
import { joinTables, JoinResult } from './joinTables';

/** Lê as duas tabelas inteiras e junta-as (sem esconder nada: isso é à saída). */
export async function computeViewJoin(
  repository: PrismaCompanyDataRepository,
  left: DataTableRecord,
  right: DataTableRecord,
  definition: ViewDefinition,
): Promise<JoinResult> {
  const [leftRows, rightRows] = await Promise.all([
    repository.findAllRows(left.id),
    left.id === right.id ? Promise.resolve(null) : repository.findAllRows(right.id),
  ]);
  const side = (columns: unknown, rows: { ref: string; data: RowData }[]) => ({
    columns: columns as DataColumn[],
    rows: rows.map((r) => r.data),
    refs: rows.map((r) => r.ref),
  });
  return joinTables({
    left: side(left.columns, leftRows),
    right: side(right.columns, rightRows ?? leftRows),
    ...definition,
  });
}
