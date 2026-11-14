import { PrismaPersonalDebtRepository } from '../repositories/prisma/prisma-personal-debt-repository';
import { debtState } from './debtState';

/**
 * O estado da dívida segue o saldo depois de um movimento: uma ativa que fica
 * sem nada por pagar passa a paga (`paid_off`), e uma paga volta a ativa se o
 * saldo voltar. Uma fechada à mão fica fechada.
 */
export async function syncDebtStatus(
  userId: string,
  debtId: string,
  repository: PrismaPersonalDebtRepository,
) {
  const debt = await repository.findDebt(userId, debtId);
  if (!debt) return;
  const balance = debtState(debt).balance;
  if (debt.status === 'active' && balance <= 0)
    await repository.updateDebt(debtId, { status: 'paid_off' });
  else if (debt.status === 'paid_off' && balance > 0)
    await repository.updateDebt(debtId, { status: 'active' });
}
