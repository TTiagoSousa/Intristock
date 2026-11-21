import { Module } from '@nestjs/common';
import { CalculatorService } from './calculator.service';
import { CalculatorController } from './calculator.controller';
import { PrismaCalculatorRepository } from './repositories/prisma/prisma-calculator-repository';

@Module({
  controllers: [CalculatorController],
  providers: [
    CalculatorService,
    {
      provide: PrismaCalculatorRepository,
      useClass: PrismaCalculatorRepository,
    },
  ],
  exports: [PrismaCalculatorRepository],
})
export class CalculatorModule {}
