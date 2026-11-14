export type FeeType = 'percentage' | 'fixed';

export interface PeriodBreakdown {
  period: number;
  contribution: number;
  interest: number;
  transactionFee: number;
  maintenanceFee: number;
  fees: number;
  balance: number;
  realBalance: number;
}

export type BreakdownGranularity = 'monthly' | 'quarterly' | 'yearly';

export interface CompoundInterestResult {
  summary: {
    totalInvested: number;
    totalContributions: number;
    totalInterestEarned: number;
    totalTransactionFeesPaid: number;
    totalMaintenanceFeesPaid: number;
    totalFeesPaid: number;
    finalBalance: number;
    finalBalanceReal: number;
  };
  breakdown: {
    monthly: PeriodBreakdown[];
    quarterly: PeriodBreakdown[];
    yearly: PeriodBreakdown[];
  };
  nativeGranularity: BreakdownGranularity;
}

export interface CompoundInterestInputs {
  initialInvestment: number;
  term: number;
  additionalInvestment: number;
  compoundingFrequency: number;
  interestRate: number;
  interestRatePeriod: string;
  transactionFeeType: FeeType;
  transactionFeeValue: number;
  maintenanceFeeType: FeeType;
  maintenanceFeeValue: number;
  missedPeriods: number;
  inflationRate: number;
}
