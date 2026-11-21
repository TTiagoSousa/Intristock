import { RatedEntry } from '../repositories/time-tracking-repository';
import { entryPayValue } from './entryPayValue';
import { localDay, DEFAULT_TIMEZONE } from './localDay';

const round = (value: number) => Math.round(value * 100) / 100;

export type TimeTrackingIncomeDue = {
  company: { id: string; name: string; slug: string };
  // YYYY-MM
  period: string;
  // O último dia do mês
  date: string;
  seconds: number;
  grossAmount: number;
  withholdingPct: number | null;
  netAmount: number;
  currency: { id: string; shortCode: string; symbol: string; rate: number };
};

/**
 * As horas por pagar de uma pessoa (nas empresas em que ela é a pessoa de uma app de horas),
 * por empresa e mês, entre `firstMonth` e `lastMonth` (YYYY-MM): quem paga à pessoa é a empresa,
 * por isso os clientes dela não aparecem. As horas que a empresa ainda não lhe pagou, ao preço da
 * pessoa (`payRate`) ou pelo valor delas, e o líquido com a retenção dela. Calcula-se ao ler;
 * pagar-lhe no banco de horas (`payouts`) tira-as daqui.
 */
export function listTimeTrackingIncomesDue(
  entries: (RatedEntry & {
    company: TimeTrackingIncomeDue['company'];
    currency: TimeTrackingIncomeDue['currency'];
  })[],
  firstMonth: string,
  lastMonth: string,
): TimeTrackingIncomeDue[] {
  const groups = new Map<string, TimeTrackingIncomeDue & { rates: Set<number | null> }>();
  for (const entry of entries) {
    // O que a empresa ainda não pagou a esta pessoa (não o que o cliente pagou à empresa)
    const value = entryPayValue(entry);
    if (value.unpaidAmount <= 0) continue;
    const period = localDay(entry.start, DEFAULT_TIMEZONE).slice(0, 7);
    if (period < firstMonth || period > lastMonth) continue;
    // A moeda entra na chave: duas ligações da mesma empresa podem ter moedas diferentes
    const key = `${entry.company.id}|${entry.currency.id}|${period}`;
    const end = new Date(`${period}-01T00:00:00Z`);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(0);
    const withholdingPct = value.withholdingPct;
    const group = groups.get(key) ?? {
      company: entry.company,
      rates: new Set<number | null>(),
      period,
      date: end.toISOString().slice(0, 10),
      seconds: 0,
      grossAmount: 0,
      withholdingPct,
      netAmount: 0,
      currency: entry.currency,
    };
    group.seconds += value.unpaidSeconds;
    group.grossAmount += value.unpaidAmount;
    group.netAmount += value.unpaidNet;
    group.rates.add(withholdingPct);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ rates, ...group }) => ({
    ...group,
    grossAmount: round(group.grossAmount),
    netAmount: round(group.netAmount),
    withholdingPct: rates.size === 1 ? [...rates][0] : null,
  }));
}
