import { ConflictException } from '@nestjs/common';
import { PrismaCalculatorRepository } from '../repositories/prisma/prisma-calculator-repository';
import { CreateCalculatorDto } from '../dto/create-calculator.dto';

export async function createCalculator(
  dto: CreateCalculatorDto,
  calculatorRepository: PrismaCalculatorRepository,
) {
  const exists = await calculatorRepository.findByAbbreviation(dto.abbreviation);
  if (exists) throw new ConflictException('Calculadora já existe');

  return calculatorRepository.create(dto);
}
