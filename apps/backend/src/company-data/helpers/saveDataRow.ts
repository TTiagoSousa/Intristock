import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DataTableRecord, PrismaCompanyDataRepository } from '../repositories/prisma/prisma-company-data-repository';
import { DataColumn, MASK, MAX_TABLE_ROWS, RowData } from './dataTypes';
import { parseCellValue } from './parseCellValue';
import { maskRow } from './maskRow';

/**
 * Uma linha escrita à mão (nova, ou a mudar uma: `rowId`). Só as colunas da
 * tabela, cada uma no tipo dela. Quem não vê os dados pessoais não os escreve
 * (um ••• que viesse de volta apagava o valor verdadeiro).
 */
export async function saveDataRow(
  repository: PrismaCompanyDataRepository,
  table: DataTableRecord,
  canSeePersonal: boolean,
  input: { data: unknown },
  rowId?: string,
) {
  const columns = table.columns as unknown as DataColumn[];
  if (!input.data || typeof input.data !== 'object' || Array.isArray(input.data)) {
    throw new BadRequestException('A linha não tem dados');
  }
  const given = input.data as Record<string, unknown>;

  const existing = rowId ? await repository.findRow(rowId) : null;
  if (rowId && (!existing || existing.tableId !== table.id)) throw new BadRequestException('Linha não encontrada');

  const data: RowData = { ...((existing?.data as RowData) ?? {}) };
  for (const column of columns) {
    if (!(column.key in given)) continue;
    const raw = given[column.key];
    if (column.personal && !canSeePersonal) {
      if (raw === MASK || raw === undefined) continue;
      throw new ForbiddenException(`Não podes escrever na coluna «${column.label}» (dados pessoais)`);
    }
    if (raw !== null && typeof raw !== 'string' && typeof raw !== 'number') {
      throw new BadRequestException(`Valor inválido em «${column.label}»`);
    }
    const parsed = parseCellValue(raw, column.type);
    if ('error' in parsed) throw new BadRequestException(`${column.label}: ${parsed.error}`);
    data[column.key] = parsed.value;
  }

  let key: string | null = null;
  if (table.keyColumn) {
    const value = data[table.keyColumn];
    if (value === null || value === undefined || String(value).trim() === '') {
      throw new BadRequestException('A coluna chave é obrigatória');
    }
    key = String(value).trim();
    const clash = await repository.findRowByKey(table.id, key);
    if (clash && clash.id !== rowId) throw new ConflictException(`Já há uma linha com «${key}»`);
  }

  if (!rowId && table._count.rows >= MAX_TABLE_ROWS) {
    throw new BadRequestException(`A tabela já tem ${MAX_TABLE_ROWS} linhas`);
  }

  const row = rowId ? await repository.updateRow(rowId, key, data) : await repository.createRow(table.id, key, data);
  await repository.touchTable(table.id);
  return { ...row, data: canSeePersonal ? (row.data as RowData) : maskRow(row.data as RowData, columns) };
}
