import { PrismaPersonalDebtRepository } from '../repositories/prisma/prisma-personal-debt-repository';
import { DebtMovementsQueryDto } from '../dto/debt-query.dto';

const toNumber = (value: unknown) => (value === null ? null : Number(value));

/** Os movimentos das dívidas da pessoa, do mais recente, com os números em número. */
export async function findDebtMovements(
  userId: string,
  query: DebtMovementsQueryDto,
  repository: PrismaPersonalDebtRepository,
) {
  const movements = await repository.findMovements(userId, {
    debtId: query.debtId,
    kind: query.kind,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
  });

  return movements.map((movement) => ({
    ...movement,
    date: movement.date.toISOString().slice(0, 10),
    amount: Number(movement.amount),
    principalPart: toNumber(movement.principalPart),
    interestPart: toNumber(movement.interestPart),
    feesPart: toNumber(movement.feesPart),
  }));
}
