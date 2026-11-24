import { BadRequestException } from '@nestjs/common';
import { CellValue, DataColumnType } from './dataTypes';
import { parseLooseNumber } from './parseCellValue';

/**
 * Os filtros por coluna das linhas (de uma tabela ou de uma tabela unida): todos têm de
 * bater. Vêm na query como JSON (`filters`). Contém, é, não é e vazio servem a todos os
 * tipos; maior/menor só os números, os valores e as datas (as datas em YYYY-MM-DD); «é um
 * de» (`in`, `values`: os escolhidos da lista dos valores da coluna, "" = vazio) só o texto.
 */
export const ROW_FILTER_OPS = ['contains', 'equals', 'not', 'empty', 'notEmpty', 'gt', 'gte', 'lt', 'lte', 'in'] as const;
export type RowFilterOp = (typeof ROW_FILTER_OPS)[number];

export const MAX_ROW_FILTERS = 10;
const MAX_VALUE = 200;
export const MAX_FILTER_VALUES = 50;
const NO_VALUE: RowFilterOp[] = ['empty', 'notEmpty'];
const COMPARE: RowFilterOp[] = ['gt', 'gte', 'lt', 'lte'];

export type RowFilterKind = 'text' | 'number' | 'date';

export interface RowFilter {
  column: string;
  op: RowFilterOp;
  kind: RowFilterKind;
  /// O texto (contém, é), o número ou a data (YYYY-MM-DD); nulo no vazio
  value: string | null;
  number: number | null;
  /// Os valores do «é um de», já sem maiúsculas nem espaços à volta ("" = vazio)
  values: string[] | null;
}

export const filterKindOf = (type: DataColumnType): RowFilterKind =>
  type === 'number' || type === 'money' ? 'number' : type === 'date' ? 'date' : 'text';

/** O texto de uma célula como se compara no «é» e no «é um de»: sem espaços à volta nem maiúsculas; vazio = "". */
export const filterText = (value: CellValue | undefined) =>
  value === null || value === undefined ? '' : String(value).trim().toLocaleLowerCase('pt-PT');

const fail = (message: string) => new BadRequestException(message);

/** Lê e valida o JSON dos filtros; uma coluna pessoal só filtra quem a vê. */
export function parseRowFilters(
  raw: string | undefined,
  columns: { key: string; type: DataColumnType; personal: boolean }[],
  canSeePersonal: boolean,
): RowFilter[] {
  if (!raw?.trim()) return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    throw fail('Os filtros não são um JSON válido');
  }
  if (!Array.isArray(list)) throw fail('Os filtros têm de ser uma lista');
  if (list.length > MAX_ROW_FILTERS) throw fail(`No máximo ${MAX_ROW_FILTERS} filtros`);

  return list.map((item: unknown): RowFilter => {
    const entry = (item ?? {}) as { column?: unknown; op?: unknown; value?: unknown; values?: unknown };
    const column = columns.find((c) => c.key === entry.column);
    if (!column || (column.personal && !canSeePersonal)) throw fail('Um filtro usa uma coluna que não existe');
    const op = entry.op as RowFilterOp;
    if (!ROW_FILTER_OPS.includes(op)) throw fail('Um filtro tem uma condição que não existe');
    const kind = filterKindOf(column.type);
    if (COMPARE.includes(op) && kind === 'text') throw fail('Maior e menor só nas colunas de números e datas');
    if (NO_VALUE.includes(op)) return { column: column.key, op, kind, value: null, number: null, values: null };
    if (op === 'in') {
      if (kind !== 'text') throw fail('«É um de» só nas colunas de texto');
      const raw = Array.isArray(entry.values) ? (entry.values as unknown[]) : [];
      if (!raw.length) throw fail('Escolhe pelo menos um valor');
      if (raw.length > MAX_FILTER_VALUES) throw fail(`No máximo ${MAX_FILTER_VALUES} valores num filtro`);
      if (!raw.every((v) => typeof v === 'string' && v.length <= MAX_VALUE)) throw fail('Um dos valores do filtro não é válido');
      const values = [...new Set((raw as string[]).map((v) => filterText(v)))];
      return { column: column.key, op, kind, value: null, number: null, values };
    }

    const value = typeof entry.value === 'number' ? String(entry.value) : typeof entry.value === 'string' ? entry.value.trim() : '';
    if (!value) throw fail('Um filtro não tem valor');
    if (value.length > MAX_VALUE) throw fail('O valor de um filtro é demasiado comprido');
    if (kind === 'text' || op === 'contains') return { column: column.key, op, kind, value, number: null, values: null };
    if (kind === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw fail('A data de um filtro tem de ser AAAA-MM-DD');
      return { column: column.key, op, kind, value, number: null, values: null };
    }
    const number = parseLooseNumber(value);
    if (number === null) throw fail('O valor de um filtro não é um número');
    return { column: column.key, op, kind, value, number, values: null };
  });
}

const isEmpty = (value: CellValue | undefined) =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

const compare = (a: number | string, b: number | string, op: RowFilterOp) =>
  op === 'gt' ? a > b : op === 'gte' ? a >= b : op === 'lt' ? a < b : op === 'lte' ? a <= b : a === b;

/**
 * Um valor bate com um filtro? A mesma regra do SQL do repositório (`rowFilterSql`):
 * o texto sem maiúsculas nem espaços à volta, os números só os gravados como número e
 * as datas pelos primeiros 10 caracteres. Um «não é» apanha também as vazias.
 */
export function matchesRowFilter(value: CellValue | undefined, filter: RowFilter): boolean {
  if (filter.op === 'empty') return isEmpty(value);
  if (filter.op === 'notEmpty') return !isEmpty(value);
  if (filter.op === 'in') return filter.values!.includes(filterText(value));
  if (filter.op === 'contains') {
    return !isEmpty(value) && String(value).toLocaleLowerCase('pt-PT').includes(filter.value!.toLocaleLowerCase('pt-PT'));
  }

  let hit: boolean;
  if (filter.kind === 'number') {
    hit = typeof value === 'number' && compare(value, filter.number!, filter.op === 'not' ? 'equals' : filter.op);
  } else if (filter.kind === 'date') {
    hit = !isEmpty(value) && compare(String(value).slice(0, 10), filter.value!, filter.op === 'not' ? 'equals' : filter.op);
  } else {
    hit = !isEmpty(value) && filterText(value) === filter.value!.toLocaleLowerCase('pt-PT');
  }
  return filter.op === 'not' ? !hit : hit;
}

export const MAX_COLUMN_VALUES = 200;

/**
 * A coluna de que se pede a lista dos valores (para o «é um de»): tem de existir, ser de
 * texto e, se for pessoal, só para quem a vê.
 */
export function assertValuesColumn(
  columns: { key: string; type: DataColumnType; personal: boolean }[],
  key: string,
  canSeePersonal: boolean,
) {
  const column = columns.find((c) => c.key === key);
  if (!column || (column.personal && !canSeePersonal)) throw fail('A coluna não existe');
  if (filterKindOf(column.type) !== 'text') throw fail('A lista dos valores só existe nas colunas de texto');
  return column;
}
