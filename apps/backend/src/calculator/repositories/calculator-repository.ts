import { Calculator } from 'src/generated/prisma/client/client';

export interface CalculatorRepository {
  create(data: {
    name: string;
    abbreviation: string;
    description: string;
    active?: boolean;
  }): Promise<Calculator>;
  findAllActive(): Promise<Calculator[]>;
  findAllActiveWithSimulationCount(userId: string): Promise<(Calculator & { _count: { simulations: number } })[]>;
  findByAbbreviation(abbreviation: string): Promise<Calculator | null>;
  findById(id: string): Promise<Calculator | null>;
}
