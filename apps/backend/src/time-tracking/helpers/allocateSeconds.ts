import { RatedEntry } from '../repositories/time-tracking-repository';
import { entryBillable } from './entryValue';

/**
 * Reparte `seconds` pelas horas por pagar dos registos, do mais antigo para o mais recente
 * (os registos já vêm por ordem): cada um leva o que lhe falta, o último pode ficar pago em
 * parte. Só os faturáveis. Devolve as alocações e o que sobrou (as horas adiantadas).
 */
export function allocateSeconds(entries: RatedEntry[], seconds: number) {
  const allocations: { entryId: string; seconds: number }[] = [];
  let left = seconds;
  for (const entry of entries) {
    if (left <= 0) break;
    if (!entryBillable(entry)) continue;
    const open = entry.seconds - Math.min(entry.paidSeconds, entry.seconds);
    if (open <= 0) continue;
    const take = Math.min(open, left);
    allocations.push({ entryId: entry.id, seconds: take });
    left -= take;
  }
  return { allocations, left };
}
