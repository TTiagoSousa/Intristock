import { ConflictException } from '@nestjs/common';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';

/**
 * Cria um portefólio manual. O nome é único na pessoa, sem contar maiúsculas.
 * Os de uma corretora (`source` api) não nascem aqui: vão nascer ao ligá-la.
 */
export async function createPortfolio(
  userId: string,
  rawName: string,
  repository: PrismaPersonalPortfolioRepository,
) {
  const name = rawName.trim();
  if (await repository.findPortfolioByName(userId, name))
    throw new ConflictException('Já tens um portefólio com esse nome');
  const portfolio = await repository.createPortfolio(userId, name);
  return { ...portfolio, platform: null, transactionCount: 0 };
}
