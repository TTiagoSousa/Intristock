import { PrismaCalculatorSimulationRepository } from '../repositories/prisma/prisma-calculator-simulation-repository';

export async function getSavedSimulations(
  userId: string,
  simulationRepository: PrismaCalculatorSimulationRepository,
) {
  return simulationRepository.findAllByUserWithCalculator(userId);
}
