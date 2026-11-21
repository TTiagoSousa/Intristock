import { IsIn, IsInt, IsNumber, Max, Min } from 'class-validator';
import { FeeType } from '../engines/compound-interest.engine';

// Os limites seguram o ciclo do motor (um período por mês, no máximo 1200): sem eles um
// `term` enorme prendia o event loop e o backend parava para todos
const MAX_AMOUNT = 1e12;

export class CreateCompoundInterestSimulationDto {
  @IsNumber()
  @Min(0)
  @Max(MAX_AMOUNT)
  initialInvestment: number;

  // Em anos
  @IsNumber()
  @Min(1)
  @Max(100)
  term: number;

  @IsNumber()
  @Min(0)
  @Max(MAX_AMOUNT)
  additionalInvestment: number;

  @IsIn([1, 4, 12])
  compoundingFrequency: 1 | 4 | 12;

  @IsNumber()
  @Min(-100)
  @Max(1000)
  interestRate: number;

  @IsIn(['annual', 'quarterly', 'monthly'])
  interestRatePeriod: 'annual' | 'quarterly' | 'monthly';

  @IsIn(['percentage', 'fixed'])
  transactionFeeType: FeeType;

  @IsNumber()
  @Min(0)
  @Max(MAX_AMOUNT)
  transactionFeeValue: number;

  @IsIn(['percentage', 'fixed'])
  maintenanceFeeType: FeeType;

  @IsNumber()
  @Min(0)
  @Max(MAX_AMOUNT)
  maintenanceFeeValue: number;

  @IsInt()
  @Min(0)
  @Max(1200)
  missedPeriods: number;

  @IsNumber()
  @Min(0)
  @Max(1000)
  inflationRate: number;
}
