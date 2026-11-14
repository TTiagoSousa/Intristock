import { BankAccount } from 'src/generated/prisma/client/client';

export interface AccountMovementTotals {
  bankAccountId: string;
  // O que entrou por recebimentos e por transferências recebidas
  credited: number;
  // O que saiu por pagamentos e por transferências enviadas
  debited: number;
}

export interface BankAccountWithBalance {
  balance: number;
  credited: number;
  debited: number;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

/**
 * Quanto há em cada conta.
 *
 * O saldo não está guardado em lado nenhum: é o valor com que a conta abriu
 * mais o que lhe entrou menos o que lhe saiu. Guardar um contador era ter de o
 * manter certo em todas as escritas e em todos os apagares; assim há sempre
 * resposta para "porque tenho este saldo", que é a mesma escolha feita no stock.
 *
 * Só contam pagamentos **concluídos** — um rascunho é uma intenção e ainda não
 * saiu do banco.
 */
export function attachAccountBalances<T extends BankAccount>(
  accounts: T[],
  totals: AccountMovementTotals[],
): (T & BankAccountWithBalance)[] {
  const byAccount = new Map(totals.map((row) => [row.bankAccountId, row]));

  return accounts.map((account) => {
    const movement = byAccount.get(account.id);
    const credited = movement?.credited ?? 0;
    const debited = movement?.debited ?? 0;

    return {
      ...account,
      credited: roundMoney(credited),
      debited: roundMoney(debited),
      balance: roundMoney(Number(account.initialBalance) + credited - debited),
    };
  });
}
