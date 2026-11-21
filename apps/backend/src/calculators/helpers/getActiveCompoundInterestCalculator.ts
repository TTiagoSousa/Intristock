import { BadRequestException } from '@nestjs/common';
import { PrismaCalculatorRepository } from 'src/calculator-catalog/repositories/prisma/prisma-calculator-repository';

const COMPOUND_INTEREST_ABBREVIATION = 'compound-interest';

export async function getActiveCompoundInterestCalculator(
  calculatorRepository: PrismaCalculatorRepository,
) {
  const calculator = await calculatorRepository.findByAbbreviation(COMPOUND_INTEREST_ABBREVIATION);

  if (!calculator || !calculator.active) {
    throw new BadRequestException('Compound interest calculator is not available');
  }

  return calculator;
}
