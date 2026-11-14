import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CalculatorSimulationRepository,
  CalculatorSimulationWithCalculator,
} from '../calculator-simulation-repository';
import { CalculatorSimulation, Prisma } from 'src/generated/prisma/client/client';

@Injectable()
export class PrismaCalculatorSimulationRepository implements CalculatorSimulationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId: string;
    calculatorId: string;
    inputs: Prisma.InputJsonValue;
    result: Prisma.InputJsonValue;
  }): Promise<CalculatorSimulation> {
    return this.prisma.calculatorSimulation.create({ data });
  }

  async findAllByUser(userId: string): Promise<CalculatorSimulation[]> {
    return this.prisma.calculatorSimulation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllByUserWithCalculator(userId: string): Promise<CalculatorSimulationWithCalculator[]> {
    return this.prisma.calculatorSimulation.findMany({
      where: { userId },
      include: { calculator: { select: { abbreviation: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllByUserAndCalculator(userId: string, calculatorId: string): Promise<CalculatorSimulation[]> {
    return this.prisma.calculatorSimulation.findMany({
      where: { userId, calculatorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteByIdAndUser(id: string, userId: string): Promise<boolean> {
    const { count } = await this.prisma.calculatorSimulation.deleteMany({ where: { id, userId } });

    return count > 0;
  }
}
