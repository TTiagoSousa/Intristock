import { NotFoundException } from '@nestjs/common';
import { PrismaCalculatorSimulationRepository } from '../repositories/prisma/prisma-calculator-simulation-repository';

export async function deleteCompoundInterestSimulation(
  userId: string,
  simulationId: string,
  simulationRepository: PrismaCalculatorSimulationRepository,
) {
  const deleted = await simulationRepository.deleteByIdAndUser(simulationId, userId);

  if (!deleted) {
    throw new NotFoundException('Simulation not found');
  }
}
