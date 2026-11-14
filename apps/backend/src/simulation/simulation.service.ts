import { Injectable } from '@nestjs/common';
import { FindTradesQueryDto } from './dto/find-trades-query.dto';
import { PrismaSimulationRepository } from './repositories/prisma/prisma-simulation-repository';
import { CreateSimulationDto } from './dto/create-simulation.dto';
import { PaginationQueryDto } from 'src/common/pagination';
import { createSimulation } from './helpers/createSimulation';
import { findSimulation } from './helpers/findSimulation';
import { findSimulations } from './helpers/findSimulations';
import { findSimulationTrades } from './helpers/findSimulationTrades';
import { findSimulationChart } from './helpers/findSimulationChart';
import { findSimulationReport } from './helpers/findSimulationReport';
import { FindReportQueryDto } from './dto/find-report-query.dto';
import { CreateMarketRunsDto } from './dto/create-market-runs.dto';
import { createMarketRuns } from './helpers/createMarketRuns';
import { findMarketRuns } from './helpers/findMarketRuns';
import { deleteSimulations } from './helpers/deleteSimulations';
import { cancelSimulation } from './helpers/cancelSimulation';

@Injectable()
export class SimulationService {
  constructor(private readonly repository: PrismaSimulationRepository) {}

  create(userId: string, dto: CreateSimulationDto) {
    return createSimulation(userId, dto, this.repository);
  }

  findAll(userId: string, query: PaginationQueryDto) {
    return findSimulations(userId, query, this.repository);
  }

  findOne(userId: string, id: string) {
    return findSimulation(userId, id, this.repository);
  }

  findTrades(userId: string, id: string, query: FindTradesQueryDto) {
    return findSimulationTrades(userId, id, query, this.repository);
  }

  findChart(userId: string, id: string) {
    return findSimulationChart(userId, id, this.repository);
  }

  findReport(userId: string, id: string, query: FindReportQueryDto) {
    return findSimulationReport(userId, id, query, this.repository);
  }

  findMarkets(userId: string, id: string) {
    return findMarketRuns(userId, id, this.repository);
  }

  createMarkets(userId: string, id: string, dto: CreateMarketRunsDto) {
    return createMarketRuns(userId, id, dto, this.repository);
  }

  cancel(userId: string, id: string) {
    return cancelSimulation(userId, id, this.repository);
  }

  delete(userId: string, ids: string[]) {
    return deleteSimulations(userId, ids, this.repository);
  }
}
