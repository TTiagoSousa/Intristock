import { DebtWithRefs } from '../repositories/personal-debt-repository';
import { debtState } from './debtState';
import { projectDebt } from './projectDebt';

const round = (value: number) => Math.round(value * 100) / 100;
const toNumber = (value: unknown) => (value === null ? null : Number(value));
const iso = (date: Date) => date.toISOString().slice(0, 10);

// Uma dívida pronta para o ecrã: os números em número, o saldo e quando acaba
export function presentDebt(debt: DebtWithRefs, today: string) {
  const { movements, ...rest } = debt;
  const state = debtState(debt);
  const installment = toNumber(debt.installment);
  const rate = toNumber(debt.interestRate);
  const projection =
    debt.status === 'active'
      ? projectDebt(state.balance, installment, rate, today.slice(0, 7))
      : { balances: [], endMonth: null };
  const principal = Number(debt.principal);

  return {
    ...rest,
    principal,
    openingBalance: Number(debt.openingBalance),
    openingDate: iso(debt.openingDate),
    interestRate: rate,
    installment,
    startDate: iso(debt.startDate),
    endDate: debt.endDate ? iso(debt.endDate) : null,
    balance: round(state.balance),
    paid: round(state.paid),
    paidPrincipal: round(state.paidPrincipal),
    interestPaid: round(state.interestPaid),
    feesPaid: round(state.feesPaid),
    charged: round(state.charged),
    lastPayment: state.lastPayment,
    // A parte do montante inicial que já não se deve (num cartão, do limite)
    paidPct:
      principal > 0
        ? Math.min(Math.max((1 - state.balance / principal) * 100, 0), 100)
        : 0,
    // Quando acaba ao ritmo de agora (a data de fim, se a tiver, manda)
    projectedEnd: debt.endDate
      ? iso(debt.endDate).slice(0, 7)
      : projection.endMonth,
    movementsCount: movements.length,
  };
}
