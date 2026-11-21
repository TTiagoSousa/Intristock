import { Module } from '@nestjs/common';
import { CalculatorsService } from './calculators.service';
import { CalculatorsController } from './calculators.controller';
import { PrismaCalculatorSimulationRepository } from './repositories/prisma/prisma-calculator-simulation-repository';
import { CalculatorModule } from 'src/calculator-catalog/calculator.module';

@Module({
  imports: [CalculatorModule],
  controllers: [CalculatorsController],
  providers: [
    CalculatorsService,
    {
      provide: PrismaCalculatorSimulationRepository,
      useClass: PrismaCalculatorSimulationRepository,
    },
  ],
})
export class CalculatorsModule {}
