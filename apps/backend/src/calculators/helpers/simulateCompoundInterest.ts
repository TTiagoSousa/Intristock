import { PrismaCalculatorRepository } from 'src/calculator/repositories/prisma/prisma-calculator-repository';
import { computeCompoundInterest } from '../engines/compound-interest.engine';
import { CreateCompoundInterestSimulationDto } from '../dto/create-compound-interest-simulation.dto';
import { getActiveCompoundInterestCalculator } from './getActiveCompoundInterestCalculator';

export async function simulateCompoundInterest(
  dto: CreateCompoundInterestSimulationDto,
  calculatorRepository: PrismaCalculatorRepository,
) {
  await getActiveCompoundInterestCalculator(calculatorRepository);

  return computeCompoundInterest(dto);
}
