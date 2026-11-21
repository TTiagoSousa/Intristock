import { RatedEntry } from '../repositories/time-tracking-repository';

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * O preço por hora de um registo: o do cliente aqui no IntriStock, senão o do projeto na app,
 * senão o da pessoa (que já traz o da organização). Sem nenhum, nulo.
 */
export function entryRate(entry: RatedEntry): number | null {
  return entry.client?.hourlyRate ?? entry.project?.billableRate ?? entry.person?.billableRate ?? null;
}

/** Se o registo conta para o valor: faturável, num projeto faturável e de um cliente que se cobra. */
export function entryBillable(entry: RatedEntry): boolean {
  return entry.billable && (entry.project?.isBillable ?? true) && entry.client?.billing !== 'none';
}

/**
 * O que um registo vale e quanto disso está pago e por pagar (pelas horas pagas nas
 * alocações). Os não faturáveis valem 0, mas as horas contam.
 */
export function entryValue(entry: RatedEntry) {
  const rate = entryBillable(entry) ? (entryRate(entry) ?? 0) : 0;
  const paidSeconds = Math.min(entry.paidSeconds, entry.seconds);
  const unpaidSeconds = entry.seconds - paidSeconds;
  return {
    rate,
    seconds: entry.seconds,
    paidSeconds,
    unpaidSeconds,
    amount: round((entry.seconds / 3600) * rate),
    paidAmount: round((paidSeconds / 3600) * rate),
    unpaidAmount: round((unpaidSeconds / 3600) * rate),
  };
}
