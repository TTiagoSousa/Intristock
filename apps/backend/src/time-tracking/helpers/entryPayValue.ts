import { RatedEntry } from '../repositories/time-tracking-repository';
import { entryBillable, entryRate } from './entryValue';

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * O que um registo vale para quem o fez (o que a empresa lhe paga): o preço por hora da pessoa
 * (`payRate`) ou, sem ele, o valor das horas (o preço do cliente; os não faturáveis valem 0).
 * O por pagar é o que ainda não está nos pagamentos à pessoa; o líquido tira a retenção dela.
 */
export function entryPayValue(entry: RatedEntry) {
  const rate = entry.person?.payRate ?? (entryBillable(entry) ? (entryRate(entry) ?? 0) : 0);
  const paidSeconds = Math.min(entry.payoutSeconds, entry.seconds);
  const unpaidSeconds = entry.seconds - paidSeconds;
  const withholdingPct = entry.person?.payWithholdingPct ?? null;
  const unpaidAmount = round((unpaidSeconds / 3600) * rate);
  return {
    rate,
    paidSeconds,
    unpaidSeconds,
    unpaidAmount,
    withholdingPct,
    unpaidNet: round(unpaidAmount * (1 - (withholdingPct ?? 0) / 100)),
  };
}
