import { Injectable } from '@nestjs/common';
import { PrismaCalculatorRepository } from './repositories/prisma/prisma-calculator-repository';
import { createCalculator } from './helpers/createCalculator';
import { findAllActiveCalculators } from './helpers/findAllActiveCalculators';
import { findCalculatorById } from './helpers/findCalculatorById';
import { CreateCalculatorDto } from './dto/create-calculator.dto';

@Injectable()
export class CalculatorService {
  constructor(private readonly calculatorRepository: PrismaCalculatorRepository) {}

  async create(dto: CreateCalculatorDto) {
    return createCalculator(dto, this.calculatorRepository);
  }

  async findAll(userId: string) {
    return findAllActiveCalculators(userId, this.calculatorRepository);
  }

  async findOne(id: string) {
    return findCalculatorById(id, this.calculatorRepository);
  }
}
