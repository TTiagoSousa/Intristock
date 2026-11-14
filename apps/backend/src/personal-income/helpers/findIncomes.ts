import { PrismaPersonalIncomeRepository } from '../repositories/prisma/prisma-personal-income-repository';
import { IncomesQueryDto } from '../dto/income-query.dto';

const toNumber = (value: unknown) => (value === null ? null : Number(value));

/**
 * Os ganhos registados da pessoa, do mais recente ao mais antigo, com os
 * números já em número e a empresa de onde veio (a da fonte, ou a que paga o
 * salário).
 */
export async function findIncomes(
  userId: string,
  query: IncomesQueryDto,
  repository: PrismaPersonalIncomeRepository,
) {
  const incomes = await repository.findIncomes(userId, {
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
    kind: query.kind,
    sourceId: query.sourceId,
    status: query.status,
  });

  return incomes.map(({ memberPay, ...income }) => ({
    ...income,
    date: income.date.toISOString().slice(0, 10),
    grossAmount: toNumber(income.grossAmount),
    amount: Number(income.amount),
    withholdingPct: toNumber(income.withholdingPct),
    company: memberPay?.member.company ?? null,
  }));
}
