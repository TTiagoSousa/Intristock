import { NotFoundException } from '@nestjs/common';
import { PrismaCalculatorRepository } from '../repositories/prisma/prisma-calculator-repository';

export async function findCalculatorById(id: string, calculatorRepository: PrismaCalculatorRepository) {
  const calculator = await calculatorRepository.findById(id);

  if (!calculator || !calculator.active) {
    throw new NotFoundException('Calculator not found');
  }

  return calculator;
}
