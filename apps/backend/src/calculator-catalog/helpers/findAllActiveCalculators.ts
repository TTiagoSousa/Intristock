import { PrismaCalculatorRepository } from '../repositories/prisma/prisma-calculator-repository';

export async function findAllActiveCalculators(userId: string, calculatorRepository: PrismaCalculatorRepository) {
  const calculators = await calculatorRepository.findAllActiveWithSimulationCount(userId);

  return calculators.map(({ _count, ...calculator }) => ({
    ...calculator,
    simulationsCount: _count.simulations,
  }));
}
