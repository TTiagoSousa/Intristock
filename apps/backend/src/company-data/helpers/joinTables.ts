import { CellValue, DataColumn, DataColumnType, JoinPair, JoinType, RowData, ViewColumn } from './dataTypes';
import { normalizeJoinValue } from './normalizeJoinValue';

export type JoinMatch = 'matched' | 'leftOnly' | 'rightOnly';

export interface JoinedColumn {
  key: string;
  label: string;
  side: 'left' | 'right';
  type: DataColumnType;
  personal: boolean;
}

export interface JoinedRow {
  /// A linha: «<linha A>|<linha B>» (a chave ou o id de cada uma; vazio do lado que falta)
  ref: string;
  match: JoinMatch;
  /// A chave aparece mais de uma vez num dos lados (a linha repete-se)
  duplicate: boolean;
  values: Record<string, CellValue>;
}

export interface JoinStats {
  matched: number;
  leftOnly: number;
  rightOnly: number;
  duplicates: number;
  leftRows: number;
  rightRows: number;
}

export interface JoinResult {
  columns: JoinedColumn[];
  rows: JoinedRow[];
  stats: JoinStats;
}

interface JoinSide {
  columns: DataColumn[];
  rows: RowData[];
  /// O que identifica cada linha (a chave ou o id), pela mesma ordem; sem eles, a posição
  refs?: string[];
}

interface JoinInput {
  left: JoinSide;
  right: JoinSide;
  joinOn: JoinPair[];
  joinType: JoinType;
  columns: ViewColumn[];
}

// A chave composta de uma linha (todos os pares têm de bater); nula se faltar um
function compositeKey(row: RowData, pairs: JoinPair[], side: 'left' | 'right') {
  const parts: string[] = [];
  for (const pair of pairs) {
    const value = normalizeJoinValue(row[side === 'left' ? pair.left : pair.right], pair.normalize);
    if (value === null) return null;
    parts.push(value);
  }
  return parts.join('\u0000');
}

/**
 * Junta duas tabelas pelas colunas escolhidas (`joinOn`, todos os pares): só as
 * que têm par (`inner`), todas as da A (`left`) ou todas de ambos (`full`).
 * Uma chave repetida de um lado repete a linha do outro, e fica marcada.
 */
/** As colunas da tabela unida (`c0`, `c1`…, pela ordem escolhida), com o tipo e o «pessoal» da coluna de origem. */
export function joinedColumns(columns: ViewColumn[], left: DataColumn[], right: DataColumn[]): JoinedColumn[] {
  return columns.map((c, i) => {
    const source = (c.side === 'left' ? left : right).find((col) => col.key === c.column);
    return {
      key: `c${i}`,
      label: c.label,
      side: c.side,
      type: source?.type ?? 'text',
      personal: source?.personal ?? false,
    };
  });
}

export function joinTables(input: JoinInput): JoinResult {
  const { left, right, joinOn, joinType } = input;
  const columns = joinedColumns(input.columns, left.columns, right.columns);
  const refOf = (side: JoinSide, index: number | null) => (index === null ? '' : (side.refs?.[index] ?? String(index)));

  const rightByKey = new Map<string, number[]>();
  right.rows.forEach((row, index) => {
    const key = compositeKey(row, joinOn, 'right');
    if (key === null) return;
    const list = rightByKey.get(key);
    if (list) list.push(index);
    else rightByKey.set(key, [index]);
  });

  const leftKeys = left.rows.map((row) => compositeKey(row, joinOn, 'left'));
  const leftCount = new Map<string, number>();
  for (const key of leftKeys) if (key !== null) leftCount.set(key, (leftCount.get(key) ?? 0) + 1);

  const build = (li: number | null, ri: number | null, match: JoinMatch, duplicate: boolean): JoinedRow => {
    const l = li === null ? null : left.rows[li];
    const r = ri === null ? null : right.rows[ri];
    const values: Record<string, CellValue> = {};
    input.columns.forEach((c, i) => {
      const source = c.side === 'left' ? l : r;
      values[`c${i}`] = source?.[c.column] ?? null;
    });
    return { ref: `${refOf(left, li)}|${refOf(right, ri)}`, match, duplicate, values };
  };

  const rows: JoinedRow[] = [];
  const usedRight = new Set<number>();
  const stats: JoinStats = { matched: 0, leftOnly: 0, rightOnly: 0, duplicates: 0, leftRows: left.rows.length, rightRows: right.rows.length };

  left.rows.forEach((_row, index) => {
    const key = leftKeys[index];
    const matches = key === null ? undefined : rightByKey.get(key);
    if (matches?.length) {
      const duplicate = matches.length > 1 || (leftCount.get(key!) ?? 0) > 1;
      for (const r of matches) {
        usedRight.add(r);
        rows.push(build(index, r, 'matched', duplicate));
        stats.matched++;
        if (duplicate) stats.duplicates++;
      }
    } else {
      stats.leftOnly++;
      if (joinType !== 'inner') rows.push(build(index, null, 'leftOnly', false));
    }
  });

  right.rows.forEach((_row, index) => {
    if (usedRight.has(index)) return;
    stats.rightOnly++;
    if (joinType === 'full') rows.push(build(null, index, 'rightOnly', false));
  });

  return { columns, rows, stats };
}
