// Até onde se projeta uma dívida (50 anos chegam para um crédito à habitação)
const MAX_PROJECTION_MONTHS = 600;

/**
 * O saldo de uma dívida mês a mês a partir de agora, a pagar a `installment`
 * por mês com os juros da TAN (`annualRate` em %, ao mês): cada prestação paga
 * primeiro os juros do mês e o resto abate o capital. Dá o saldo no fim de cada
 * mês (o primeiro é o atual) e o mês em que acaba; sem prestação, ou se a
 * prestação não chega para os juros, não acaba (`endMonth` nulo).
 */
export function projectDebt(
  balance: number,
  installment: number | null,
  annualRate: number | null,
  fromMonth: string,
) {
  const balances: number[] = [];
  if (!installment || balance <= 0)
    return { balances, endMonth: balance <= 0 ? fromMonth : null };

  const monthlyRate = (annualRate ?? 0) / 100 / 12;
  if (installment <= balance * monthlyRate) return { balances, endMonth: null };

  const [year, month] = fromMonth.split('-').map(Number);
  let remaining = balance;
  let months = 0;
  while (remaining > 0.005 && months < MAX_PROJECTION_MONTHS) {
    remaining = Math.max(remaining * (1 + monthlyRate) - installment, 0);
    balances.push(remaining);
    months += 1;
  }
  const end = new Date(Date.UTC(year, month - 1 + months - 1, 1));
  return {
    balances,
    endMonth: remaining > 0.005 ? null : end.toISOString().slice(0, 7),
  };
}
