import { PrismaCalculatorRepository } from 'src/calculator/repositories/prisma/prisma-calculator-repository';
import { PrismaCalculatorSimulationRepository } from '../repositories/prisma/prisma-calculator-simulation-repository';
import { getActiveCompoundInterestCalculator } from './getActiveCompoundInterestCalculator';

export async function getSavedCompoundInterestSimulations(
  userId: string,
  calculatorRepository: PrismaCalculatorRepository,
  simulationRepository: PrismaCalculatorSimulationRepository,
) {
  const calculator = await getActiveCompoundInterestCalculator(calculatorRepository);

  return simulationRepository.findAllByUserAndCalculator(userId, calculator.id);
}
