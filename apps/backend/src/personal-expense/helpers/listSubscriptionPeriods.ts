// Uma subscrição como o calendário dela precisa (o resto não interessa aqui)
type SubscriptionPlan = {
  recurring: boolean;
  intervalMonths: number;
  billingDay: number | null;
  startDate: Date;
  endDate: Date | null;
};

const monthKey = (date: Date) => date.toISOString().slice(0, 7);

/**
 * Os pagamentos de uma subscrição entre `from` e `until` (inclusive), cada um
 * com o período e o dia. Uma recorrente paga no mês do início e depois de
 * `intervalMonths` em `intervalMonths` meses, no `billingDay` (o último dia,
 * nos meses mais curtos; no primeiro, nunca antes do início), até ao `endDate`.
 * Uma não recorrente é um só pagamento (`once`), no dia do início.
 */
export function listSubscriptionPeriods(
  plan: SubscriptionPlan,
  from: Date,
  until: Date,
) {
  const periods: { period: string; date: Date }[] = [];
  if (!plan.recurring) {
    if (plan.startDate >= from && plan.startDate <= until)
      periods.push({ period: 'once', date: plan.startDate });
    return periods;
  }

  const day = plan.billingDay ?? plan.startDate.getUTCDate();
  const step = Math.max(1, plan.intervalMonths);
  const year = plan.startDate.getUTCFullYear();
  const month = plan.startDate.getUTCMonth();
  for (let index = 0; ; index += step) {
    const daysInMonth = new Date(
      Date.UTC(year, month + index + 1, 0),
    ).getUTCDate();
    let date = new Date(
      Date.UTC(year, month + index, Math.min(day, daysInMonth)),
    );
    if (index === 0 && date < plan.startDate) date = plan.startDate;
    if (date > until || (plan.endDate && date > plan.endDate)) break;
    if (date >= from) periods.push({ period: monthKey(date), date });
  }
  return periods;
}
