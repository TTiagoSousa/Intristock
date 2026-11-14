import { PrismaPersonalDebtRepository } from '../repositories/prisma/prisma-personal-debt-repository';
import { presentDebt } from './presentDebt';

/** As dívidas da pessoa, as ativas primeiro, com o saldo e o que já pagou. */
export async function findDebts(
  userId: string,
  repository: PrismaPersonalDebtRepository,
) {
  const today = new Date().toISOString().slice(0, 10);
  const debts = await repository.findDebts(userId);
  return debts.map((debt) => presentDebt(debt, today));
}
