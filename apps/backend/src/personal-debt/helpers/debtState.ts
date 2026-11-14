import { DebtWithRefs } from '../repositories/personal-debt-repository';

const iso = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Onde está uma dívida num dia (por omissão, hoje e tudo o que está gravado):
 * o saldo é o `openingBalance` menos o capital pago e mais o que se lhe juntou,
 * contando só os movimentos a partir da `openingDate` (os de antes já estão no
 * valor de abertura). Também os juros e os encargos pagos e o último pagamento.
 */
export function debtState(debt: DebtWithRefs, until?: string) {
  const opening = iso(debt.openingDate);
  let balance = Number(debt.openingBalance);
  let paidPrincipal = 0;
  let paid = 0;
  let interestPaid = 0;
  let feesPaid = 0;
  let charged = 0;
  let lastPayment: string | null = null;

  for (const movement of debt.movements) {
    const date = iso(movement.date);
    if (date < opening || (until && date > until)) continue;
    const amount = Number(movement.amount);
    if (movement.kind === 'charge') {
      balance += amount;
      charged += amount;
      continue;
    }
    const principal =
      movement.principalPart === null ? amount : Number(movement.principalPart);
    balance -= principal;
    paidPrincipal += principal;
    paid += amount;
    interestPaid += Number(movement.interestPart ?? 0);
    feesPaid += Number(movement.feesPart ?? 0);
    if (!lastPayment || date > lastPayment) lastPayment = date;
  }

  return {
    balance: Math.max(balance, 0),
    paid,
    paidPrincipal,
    interestPaid,
    feesPaid,
    charged,
    lastPayment,
  };
}
