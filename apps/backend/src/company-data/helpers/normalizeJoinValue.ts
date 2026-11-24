import { CellValue, JoinNormalize } from './dataTypes';

/**
 * O valor de uma coluna como se compara numa tabela unida: os passos escolhidos
 * aplicam-se sempre pela mesma ordem (espaços → até ao primeiro espaço →
 * maiúsculas → só dígitos). Vazio no fim = não bate com nada.
 */
export function normalizeJoinValue(value: CellValue | undefined, steps: JoinNormalize[]): string | null {
  if (value === null || value === undefined) return null;
  let s = String(value);
  const has = new Set(steps);
  if (has.has('trim') || has.has('firstToken')) s = s.trim().replace(/\s+/g, ' ');
  if (has.has('firstToken')) s = s.split(' ')[0];
  if (has.has('lower')) s = s.toLocaleLowerCase('pt-PT');
  if (has.has('digits')) s = s.replace(/\D/g, '');
  return s === '' ? null : s;
}
