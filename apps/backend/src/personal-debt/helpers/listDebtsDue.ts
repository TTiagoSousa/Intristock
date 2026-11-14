import { DebtWithRefs } from '../repositories/personal-debt-repository';
import { debtState } from './debtState';

const iso = (date: Date) => date.toISOString().slice(0, 10);

export type DebtDue = {
  debtId: string;
  name: string;
  kind: string;
  direction: string;
  period: string;
  date: string;
  overdue: boolean;
  amount: number;
  // Os juros do mês à TAN sobre o saldo de agora (para partir a prestação)
  interestEstimate: number | null;
  currency: DebtWithRefs['currency'];
};

/**
 * As prestações por pagar de cada dívida ativa com prestação e dia, de
 * `firstMonth` a `until`: uma por mês no dia dela (no último dia, nos meses
 * mais curtos), entre o início e o fim da dívida, não antes de ela ser
 * registada (`openingDate`) e menos as que já têm um movimento com esse mês.
 * Uma dívida já paga não dá mais.
 */
export function listDebtsDue(
  debts: DebtWithRefs[],
  firstMonth: Date,
  until: Date,
  today: string,
) {
  const due: DebtDue[] = [];

  for (const debt of debts) {
    if (debt.status !== 'active' || !debt.installment || !debt.paymentDay)
      continue;
    const state = debtState(debt);
    if (state.balance <= 0) continue;

    const installment = Number(debt.installment);
    const rate = debt.interestRate === null ? null : Number(debt.interestRate);
    const recorded = new Set(
      debt.movements.map((movement) => movement.period).filter(Boolean),
    );
    const interest =
      rate === null
        ? null
        : Math.round(((state.balance * rate) / 100 / 12) * 100) / 100;
    // A última prestação é só o que falta (com os juros do mês)
    const amount = Math.min(installment, state.balance + (interest ?? 0));
    const start =
      iso(debt.startDate) > iso(debt.openingDate)
        ? debt.startDate
        : debt.openingDate;
    const end = debt.endDate ? iso(debt.endDate) : null;

    for (
      let cursor = new Date(firstMonth);
      cursor <= until;
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    ) {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth();
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const date = iso(
        new Date(Date.UTC(year, month, Math.min(debt.paymentDay, lastDay))),
      );
      const period = date.slice(0, 7);
      if (date < iso(start) || (end && date > end) || recorded.has(period))
        continue;

      due.push({
        debtId: debt.id,
        name: debt.name,
        kind: debt.kind,
        direction: debt.direction,
        period,
        date,
        overdue: date < today,
        amount: Math.round(amount * 100) / 100,
        interestEstimate: interest,
        currency: debt.currency,
      });
    }
  }

  return due.sort((a, b) => a.date.localeCompare(b.date));
}
