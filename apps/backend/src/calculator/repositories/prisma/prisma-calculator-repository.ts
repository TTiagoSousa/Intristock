import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CalculatorRepository } from '../calculator-repository';
import { Calculator } from 'src/generated/prisma/client/client';

@Injectable()
export class PrismaCalculatorRepository implements CalculatorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    name: string;
    abbreviation: string;
    description: string;
    active?: boolean;
  }): Promise<Calculator> {
    return this.prisma.calculator.create({ data });
  }

  async findAllActive(): Promise<Calculator[]> {
    return this.prisma.calculator.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAllActiveWithSimulationCount(
    userId: string,
  ): Promise<(Calculator & { _count: { simulations: number } })[]> {
    return this.prisma.calculator.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            simulations: { where: { userId } },
          },
        },
      },
    });
  }

  async findByAbbreviation(abbreviation: string): Promise<Calculator | null> {
    return this.prisma.calculator.findUnique({ where: { abbreviation } });
  }

  async findById(id: string): Promise<Calculator | null> {
    return this.prisma.calculator.findUnique({ where: { id } });
  }
}
