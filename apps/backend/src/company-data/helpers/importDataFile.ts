import { BadRequestException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client/client';
import { DataTableRecord, PrismaCompanyDataRepository } from '../repositories/prisma/prisma-company-data-repository';
import { ImportRow } from '../repositories/company-data-repository';
import { DataColumn, ImportConfig, MAX_TABLE_ROWS, RowData } from './dataTypes';
import { readSpreadsheet } from './readSpreadsheet';
import { parseCellValue } from './parseCellValue';
import { sanitizeFileName } from 'src/company-payment-document/helpers/assertFileIsAllowed';

const MAX_ERRORS = 50;

type ImportError = { row: number; message: string };

/**
 * Importa um ficheiro para a tabela: cada cabeçalho do ficheiro vai para a
 * coluna escolhida (`mapping`; os que não estão ficam de fora). Com coluna
 * chave, as linhas que já existem atualizam-se e as repetidas no ficheiro
 * contam a última; sem ela, acrescentam-se. Tudo numa transação: um erro a
 * meio não deixa meia importação. A ligação fica para a próxima vez.
 */
export async function importDataFile(
  repository: PrismaCompanyDataRepository,
  table: DataTableRecord,
  userId: string,
  file: { buffer: Buffer; size: number; originalname: string },
  config: ImportConfig,
) {
  const fileName = sanitizeFileName(file.originalname);
  const columns = table.columns as unknown as DataColumn[];
  const byKey = new Map(columns.map((c) => [c.key, c]));

  const sheet = readSpreadsheet(file);
  const rows = config.skipTotals && sheet.totalsRowDetected ? sheet.rows.slice(0, -1) : sheet.rows;

  // Cabeçalho do ficheiro → índice; ligação → coluna
  const mapped: { index: number; column: DataColumn }[] = [];
  const mapping: Record<string, string> = {};
  for (const [header, key] of Object.entries(config.mapping)) {
    const index = sheet.headers.indexOf(header);
    const column = byKey.get(key);
    if (index < 0 || !column) continue;
    if (mapped.some((m) => m.column.key === key)) {
      throw new BadRequestException(`Dois cabeçalhos do ficheiro vão para a coluna «${column.label}»`);
    }
    mapped.push({ index, column });
    mapping[header] = key;
  }
  if (!mapped.length) throw new BadRequestException('Liga pelo menos um cabeçalho do ficheiro a uma coluna');
  if (table.keyColumn && !mapped.some((m) => m.column.key === table.keyColumn)) {
    throw new BadRequestException(`A coluna chave «${byKey.get(table.keyColumn)?.label}» tem de vir do ficheiro`);
  }

  const errors: ImportError[] = [];
  let skipped = 0;
  const addError = (row: number, message: string) => {
    if (errors.length < MAX_ERRORS) errors.push({ row, message });
  };

  // A linha 1 é o cabeçalho; a 2 a primeira de dados (aproximado: as vazias já saíram)
  const parsed: ImportRow[] = [];
  const positionByKey = new Map<string, number>();
  rows.forEach((cells, i) => {
    const line = i + 2;
    const data: RowData = {};
    for (const { index, column } of mapped) {
      const result = parseCellValue(cells[index], column.type);
      if ('error' in result) {
        addError(line, `${column.label}: ${result.error}`);
        data[column.key] = null;
      } else data[column.key] = result.value;
    }

    if (!table.keyColumn) {
      parsed.push({ key: null, data });
      return;
    }
    const keyValue = data[table.keyColumn];
    if (keyValue === null || keyValue === undefined || String(keyValue).trim() === '') {
      skipped++;
      addError(line, 'Sem valor na coluna chave');
      return;
    }
    const key = String(keyValue).trim();
    const previous = positionByKey.get(key);
    if (previous !== undefined) {
      // Repetida no ficheiro: fica a última
      skipped++;
      parsed[previous] = { key, data };
      return;
    }
    positionByKey.set(key, parsed.length);
    parsed.push({ key, data });
  });

  const existing = await repository.countRows(table.id);
  if (!table.keyColumn && existing + parsed.length > MAX_TABLE_ROWS) {
    throw new BadRequestException(`A tabela ficava com mais de ${MAX_TABLE_ROWS} linhas`);
  }

  try {
    return await repository.transaction(async (tx) => {
      const record = await repository.createImport(tx, {
        tableId: table.id,
        fileName,
        status: 'done',
        createdById: userId,
      });
      const counts = table.keyColumn
        ? await repository.upsertRows(tx, table.id, record.id, parsed)
        : { created: await repository.insertRows(tx, table.id, record.id, parsed), updated: 0, unchanged: 0 };

      if (table.keyColumn && (await repository.countRows(table.id, tx)) > MAX_TABLE_ROWS) {
        throw new BadRequestException(`A tabela ficava com mais de ${MAX_TABLE_ROWS} linhas`);
      }

      await repository.updateTable(
        table.id,
        { importConfig: { mapping, skipTotals: config.skipTotals } as Prisma.InputJsonValue, updatedAt: new Date() },
        tx,
      );
      return repository.updateImport(
        record.id,
        { ...counts, skipped, errors: errors.length ? (errors as Prisma.InputJsonValue) : Prisma.DbNull },
        tx,
      );
    });
  } catch (error) {
    // A transação voltou atrás; fica o registo de que falhou
    const message = error instanceof BadRequestException ? error.message : 'A importação falhou a gravar';
    await repository.recordFailedImport({
      tableId: table.id,
      fileName,
      status: 'failed',
      errors: [{ row: 0, message }] as Prisma.InputJsonValue,
      createdById: userId,
    });
    throw error;
  }
}
