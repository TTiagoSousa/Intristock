import { BadRequestException } from '@nestjs/common';
import {
  DataColumn,
  JOIN_NORMALIZE,
  JOIN_TYPES,
  JoinNormalize,
  JoinPair,
  JoinType,
  MAX_JOIN_PAIRS,
  MAX_VIEW_COLUMNS,
  ViewColumn,
} from './dataTypes';

export interface ViewDefinition {
  joinOn: JoinPair[];
  joinType: JoinType;
  columns: ViewColumn[];
}

/** Valida os pares, o tipo e as colunas de uma tabela unida contra as colunas das duas tabelas. */
export function assertViewDefinition(
  input: { joinOn: unknown; joinType: unknown; columns: unknown },
  left: DataColumn[],
  right: DataColumn[],
): ViewDefinition {
  const leftKeys = new Set(left.map((c) => c.key));
  const rightKeys = new Set(right.map((c) => c.key));

  if (!JOIN_TYPES.includes(input.joinType as JoinType)) throw new BadRequestException('Tipo de junção inválido');

  if (!Array.isArray(input.joinOn) || !input.joinOn.length) {
    throw new BadRequestException('Escolhe pelo menos um par de colunas para ligar as tabelas');
  }
  if (input.joinOn.length > MAX_JOIN_PAIRS) throw new BadRequestException(`No máximo ${MAX_JOIN_PAIRS} pares`);
  const joinOn = input.joinOn.map((raw) => {
    const p = (raw ?? {}) as Partial<JoinPair>;
    if (!p.left || !leftKeys.has(p.left)) throw new BadRequestException('Uma coluna da tabela A não existe');
    if (!p.right || !rightKeys.has(p.right)) throw new BadRequestException('Uma coluna da tabela B não existe');
    const normalize = Array.isArray(p.normalize) ? p.normalize : [];
    if (!normalize.every((n) => JOIN_NORMALIZE.includes(n))) throw new BadRequestException('Limpeza inválida');
    return { left: p.left, right: p.right, normalize: [...new Set(normalize)] as JoinNormalize[] };
  });

  if (!Array.isArray(input.columns) || !input.columns.length) {
    throw new BadRequestException('Escolhe as colunas da tabela unida');
  }
  if (input.columns.length > MAX_VIEW_COLUMNS) throw new BadRequestException(`No máximo ${MAX_VIEW_COLUMNS} colunas`);
  const columns = input.columns.map((raw) => {
    const c = (raw ?? {}) as Partial<ViewColumn>;
    if (c.side !== 'left' && c.side !== 'right') throw new BadRequestException('Coluna inválida');
    const keys = c.side === 'left' ? leftKeys : rightKeys;
    if (!c.column || !keys.has(c.column)) throw new BadRequestException('Uma das colunas escolhidas não existe');
    const source = (c.side === 'left' ? left : right).find((col) => col.key === c.column)!;
    const label = typeof c.label === 'string' && c.label.trim() ? c.label.trim().slice(0, 80) : source.label;
    return { side: c.side, column: c.column, label };
  });

  return { joinOn, joinType: input.joinType as JoinType, columns };
}
