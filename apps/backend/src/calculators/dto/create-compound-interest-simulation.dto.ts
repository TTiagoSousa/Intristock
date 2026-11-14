import { IsIn, IsInt, IsNumber, Min } from 'class-validator';
import { FeeType } from '../engines/compound-interest.engine';

export class CreateCompoundInterestSimulationDto {
  @IsNumber()
  @Min(0)
  initialInvestment: number;

  @IsNumber()
  @Min(1)
  term: number;

  @IsNumber()
  @Min(0)
  additionalInvestment: number;

  @IsIn([1, 4, 12])
  compoundingFrequency: 1 | 4 | 12;

  @IsNumber()
  interestRate: number;

  @IsIn(['annual', 'quarterly', 'monthly'])
  interestRatePeriod: 'annual' | 'quarterly' | 'monthly';

  @IsIn(['percentage', 'fixed'])
  transactionFeeType: FeeType;

  @IsNumber()
  @Min(0)
  transactionFeeValue: number;

  @IsIn(['percentage', 'fixed'])
  maintenanceFeeType: FeeType;

  @IsNumber()
  @Min(0)
  maintenanceFeeValue: number;

  @IsInt()
  @Min(0)
  missedPeriods: number;

  @IsNumber()
  @Min(0)
  inflationRate: number;
}
