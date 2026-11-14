import { CalculatorSimulation, Prisma } from 'src/generated/prisma/client/client';

// Uma simulação com a calculadora de onde veio (para a lista de todas)
export type CalculatorSimulationWithCalculator = CalculatorSimulation & {
  calculator: { abbreviation: string; name: string };
};

export interface CalculatorSimulationRepository {
  create(data: {
    userId: string;
    calculatorId: string;
    inputs: Prisma.InputJsonValue;
    result: Prisma.InputJsonValue;
  }): Promise<CalculatorSimulation>;
  findAllByUser(userId: string): Promise<CalculatorSimulation[]>;
  findAllByUserWithCalculator(userId: string): Promise<CalculatorSimulationWithCalculator[]>;
  findAllByUserAndCalculator(userId: string, calculatorId: string): Promise<CalculatorSimulation[]>;
  deleteByIdAndUser(id: string, userId: string): Promise<boolean>;
}
