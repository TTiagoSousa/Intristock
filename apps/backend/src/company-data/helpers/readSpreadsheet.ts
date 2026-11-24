import { BadRequestException } from '@nestjs/common';
import { CellValue, MAX_FILE_BYTES, MAX_IMPORT_ROWS } from './dataTypes';
import { readXlsx } from './readXlsx';
import { readCsv } from './readCsv';

export interface Spreadsheet {
  headers: string[];
  /// As linhas de dados, já sem as vazias, com tantas células como cabeçalhos
  rows: CellValue[][];
  /// A última linha começa por «Total» (a linha de totais de muitos exports)
  totalsRowDetected: boolean;
}

const isEmpty = (row: CellValue[]) => row.every((v) => v === null || v === '');

/**
 * Lê um .xlsx ou um .csv (pelos primeiros bytes, não pelo nome) e devolve os
 * cabeçalhos — a primeira linha com alguma coisa — e as linhas de dados.
 */
export function readSpreadsheet(file: { buffer: Buffer; size: number }): Spreadsheet {
  if (!file.buffer || file.size === 0) throw new BadRequestException('O ficheiro está vazio');
  if (file.size > MAX_FILE_BYTES) {
    throw new BadRequestException(`O ficheiro é grande demais (máximo ${MAX_FILE_BYTES / 1024 / 1024} MB)`);
  }

  const head = file.buffer.subarray(0, 8);
  let raw: CellValue[][];
  if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) raw = readXlsx(file.buffer);
  else if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) {
    throw new BadRequestException('Os .xls antigos não se leem — guarda-o como .xlsx ou .csv');
  } else if (file.buffer.subarray(0, 4096).includes(0)) {
    throw new BadRequestException('Só se aceitam ficheiros Excel (.xlsx) ou CSV');
  } else raw = readCsv(file.buffer);

  const headerIndex = raw.findIndex((row) => !isEmpty(row));
  if (headerIndex < 0) throw new BadRequestException('O ficheiro não tem dados');

  const seen = new Map<string, number>();
  const headerRow = raw[headerIndex];
  const width = Math.max(headerRow.length, ...raw.slice(headerIndex + 1).map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => {
    const value = headerRow[i];
    const base = value === null || value === undefined || String(value).trim() === '' ? `Coluna ${i + 1}` : String(value).trim();
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });

  const rows = raw
    .slice(headerIndex + 1)
    .filter((row) => !isEmpty(row))
    .map((row) => Array.from({ length: width }, (_, i) => row[i] ?? null));

  if (rows.length > MAX_IMPORT_ROWS + 1) {
    throw new BadRequestException(`O ficheiro tem ${rows.length} linhas — o máximo por importação é ${MAX_IMPORT_ROWS}`);
  }

  const last = rows[rows.length - 1];
  const firstValue = last?.find((v) => v !== null);
  const totalsRowDetected = typeof firstValue === 'string' && /^total\b/i.test(firstValue.trim());

  return { headers, rows, totalsRowDetected };
}
