import { NotFoundException } from '@nestjs/common';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';

/** As transações de um portefólio da pessoa, das mais recentes. */
export async function findPortfolioTransactions(
  userId: string,
  portfolioId: string,
  repository: PrismaPersonalPortfolioRepository,
) {
  if (!(await repository.findPortfolio(userId, portfolioId)))
    throw new NotFoundException('Portefólio não encontrado');
  return repository.findTransactions(portfolioId);
}
