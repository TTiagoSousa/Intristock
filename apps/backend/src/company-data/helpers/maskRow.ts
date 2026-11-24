import { CellValue, DataColumn, MASK } from './dataTypes';

/** Os valores das colunas pessoais passam a ••• (os vazios ficam vazios). */
export function maskRow(data: Record<string, CellValue>, columns: Pick<DataColumn, 'key' | 'personal'>[]) {
  const out = { ...data };
  for (const column of columns) {
    if (column.personal && out[column.key] !== null && out[column.key] !== undefined) out[column.key] = MASK;
  }
  return out;
}
