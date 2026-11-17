import { NotFoundException } from '@nestjs/common';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';

/**
 * As transações de um portefólio da pessoa, das mais recentes. Num de uma corretora com
 * `fromDate`, só desse dia em diante.
 */
export async function findPortfolioTransactions(
  userId: string,
  portfolioId: string,
  repository: PrismaPersonalPortfolioRepository,
) {
  const portfolio = await repository.findPortfolio(userId, portfolioId);
  if (!portfolio) throw new NotFoundException('Portefólio não encontrado');
  const connection = portfolio.connectionId
    ? await repository.findConnection(portfolio.connectionId)
    : null;
  return repository.findTransactions(portfolioId, connection?.fromDate);
}
