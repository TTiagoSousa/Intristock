import { IncomeSourceWithRefs } from '../repositories/personal-income-repository';

// Os subsídios de quem recebe 14 vezes: o de férias em junho, o de Natal em dezembro
const HOLIDAY_MONTH = 5;
const CHRISTMAS_MONTH = 11;

const iso = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Os salários de cada fonte com salário fixo entre `firstMonth` e `until`: um
 * por mês no dia dele (e os subsídios de quem recebe 14 vezes), menos os já
 * registados (`recorded`, `sourceId|período`). Uma fonte sem o salário todo
 * (valor, moeda, dia e início) ou desativada não dá nada.
 */
export function listSourceIncomesDue(
  sources: IncomeSourceWithRefs[],
  recorded: Set<string>,
  firstMonth: Date,
  until: Date,
) {
  const due: {
    source: IncomeSourceWithRefs;
    period: string;
    part: string;
    date: string;
  }[] = [];

  for (const source of sources) {
    if (
      !source.isActive ||
      !source.currency ||
      !source.payDay ||
      !source.startDate ||
      (source.grossAmount === null && source.netAmount === null)
    )
      continue;

    for (
      let cursor = new Date(firstMonth);
      cursor <= until;
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    ) {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth();
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const date = new Date(
        Date.UTC(year, month, Math.min(source.payDay, daysInMonth)),
      );
      if (date > until) continue;
      if (date < source.startDate || (source.endDate && date > source.endDate))
        continue;

      const period = `${year}-${String(month + 1).padStart(2, '0')}`;
      const parts: [string, string][] = [[period, 'salary']];
      if (source.paymentsPerYear === 14 && month === HOLIDAY_MONTH)
        parts.push([`${period}:holiday`, 'holiday']);
      if (source.paymentsPerYear === 14 && month === CHRISTMAS_MONTH)
        parts.push([`${period}:christmas`, 'christmas']);

      for (const [key, part] of parts) {
        if (!recorded.has(`${source.id}|${key}`))
          due.push({ source, period: key, part, date: iso(date) });
      }
    }
  }

  return due;
}
