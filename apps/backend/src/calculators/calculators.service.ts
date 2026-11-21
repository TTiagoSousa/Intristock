import { Injectable } from '@nestjs/common';
import { PrismaCalculatorRepository } from 'src/calculator-catalog/repositories/prisma/prisma-calculator-repository';
import { PrismaCalculatorSimulationRepository } from './repositories/prisma/prisma-calculator-simulation-repository';
import { simulateCompoundInterest } from './helpers/simulateCompoundInterest';
import { saveCompoundInterestSimulation } from './helpers/saveCompoundInterestSimulation';
import { getSavedCompoundInterestSimulations } from './helpers/getSavedCompoundInterestSimulations';
import { deleteCompoundInterestSimulation } from './helpers/deleteCompoundInterestSimulation';
import { getSavedSimulations } from './helpers/getSavedSimulations';
import { CreateCompoundInterestSimulationDto } from './dto/create-compound-interest-simulation.dto';

@Injectable()
export class CalculatorsService {
  constructor(
    private readonly calculatorRepository: PrismaCalculatorRepository,
    private readonly simulationRepository: PrismaCalculatorSimulationRepository,
  ) {}

  async simulateCompoundInterest(dto: CreateCompoundInterestSimulationDto) {
    return simulateCompoundInterest(dto, this.calculatorRepository);
  }

  async saveCompoundInterestSimulation(userId: string, dto: CreateCompoundInterestSimulationDto) {
    return saveCompoundInterestSimulation(
      userId,
      dto,
      this.calculatorRepository,
      this.simulationRepository,
    );
  }

  async getSavedCompoundInterestSimulations(userId: string) {
    return getSavedCompoundInterestSimulations(userId, this.calculatorRepository, this.simulationRepository);
  }

  async getSavedSimulations(userId: string) {
    return getSavedSimulations(userId, this.simulationRepository);
  }

  async deleteSimulation(userId: string, simulationId: string) {
    return deleteCompoundInterestSimulation(userId, simulationId, this.simulationRepository);
  }

  async deleteCompoundInterestSimulation(userId: string, simulationId: string) {
    return deleteCompoundInterestSimulation(userId, simulationId, this.simulationRepository);
  }
}
