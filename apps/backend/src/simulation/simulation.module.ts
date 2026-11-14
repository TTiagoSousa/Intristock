import { Module } from '@nestjs/common';
import { SimulationController } from './simulation.controller';
import { SimulationService } from './simulation.service';
import { PrismaSimulationRepository } from './repositories/prisma/prisma-simulation-repository';

// Simulações de estratégias. Quem as corre é o simulador em Python
// (apps/simulator), com as velas que o downloader deixou no ClickHouse
@Module({
  controllers: [SimulationController],
  providers: [
    SimulationService,
    {
      provide: PrismaSimulationRepository,
      useClass: PrismaSimulationRepository,
    },
  ],
})
export class SimulationModule {}
