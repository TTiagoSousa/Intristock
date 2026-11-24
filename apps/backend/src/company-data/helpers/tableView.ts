import { DataTableRecord } from '../repositories/prisma/prisma-company-data-repository';
import { DataColumn, ImportConfig } from './dataTypes';

/** Uma tabela como o ecrã a recebe. */
export function tableView(table: DataTableRecord) {
  return {
    id: table.id,
    name: table.name,
    source: table.source,
    columns: table.columns as unknown as DataColumn[],
    keyColumn: table.keyColumn,
    importConfig: (table.importConfig as unknown as ImportConfig | null) ?? null,
    rowCount: table._count.rows,
    lastImportAt: table.imports[0]?.createdAt ?? null,
    createdAt: table.createdAt,
    updatedAt: table.updatedAt,
  };
}
