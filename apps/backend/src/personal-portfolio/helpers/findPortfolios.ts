import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';

/** Os portefólios da pessoa, com quantas transações tem cada um. */
export async function findPortfolios(
  userId: string,
  repository: PrismaPersonalPortfolioRepository,
) {
  const portfolios = await repository.findPortfolios(userId);
  return portfolios.map(({ _count, ...portfolio }) => ({
    ...portfolio,
    transactionCount: _count.transactions,
  }));
}
