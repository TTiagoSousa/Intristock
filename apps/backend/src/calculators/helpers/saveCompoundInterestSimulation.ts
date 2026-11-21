import { Prisma } from 'src/generated/prisma/client/client';
import { PrismaCalculatorRepository } from 'src/calculator-catalog/repositories/prisma/prisma-calculator-repository';
import { PrismaCalculatorSimulationRepository } from '../repositories/prisma/prisma-calculator-simulation-repository';
import { computeCompoundInterest } from '../engines/compound-interest.engine';
import { CreateCompoundInterestSimulationDto } from '../dto/create-compound-interest-simulation.dto';
import { getActiveCompoundInterestCalculator } from './getActiveCompoundInterestCalculator';

export async function saveCompoundInterestSimulation(
  userId: string,
  dto: CreateCompoundInterestSimulationDto,
  calculatorRepository: PrismaCalculatorRepository,
  simulationRepository: PrismaCalculatorSimulationRepository,
) {
  const calculator = await getActiveCompoundInterestCalculator(calculatorRepository);
  const result = computeCompoundInterest(dto);

  return simulationRepository.create({
    userId,
    calculatorId: calculator.id,
    inputs: { ...dto } as Prisma.InputJsonValue,
    result: result as unknown as Prisma.InputJsonValue,
  });
}
