export type FeeType = 'percentage' | 'fixed';

export interface CompoundInterestInputs {
  initialInvestment: number;
  term: number;
  additionalInvestment: number;
  compoundingFrequency: 1 | 4 | 12;
  interestRate: number;
  interestRatePeriod: 'annual' | 'quarterly' | 'monthly';
  transactionFeeType: FeeType;
  transactionFeeValue: number;
  maintenanceFeeType: FeeType;
  maintenanceFeeValue: number;
  missedPeriods: number;
  inflationRate: number;
}

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
  // granularidade que corresponde aos períodos de capitalização reais;
  // as outras duas são estimadas por interpolação, não pontos de capitalização de facto
  nativeGranularity: BreakdownGranularity;
}

const RATE_PERIODS_PER_YEAR: Record<CompoundInterestInputs['interestRatePeriod'], number> = {
  annual: 1,
  quarterly: 4,
  monthly: 12,
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function groupPeriods(periods: PeriodBreakdown[], chunkSize: number): PeriodBreakdown[] {
  const grouped: PeriodBreakdown[] = [];

  for (let i = 0; i < periods.length; i += chunkSize) {
    const chunk = periods.slice(i, i + chunkSize);
    const contribution = round(chunk.reduce((sum, p) => sum + p.contribution, 0));
    const interest = round(chunk.reduce((sum, p) => sum + p.interest, 0));
    const transactionFee = round(chunk.reduce((sum, p) => sum + p.transactionFee, 0));
    const maintenanceFee = round(chunk.reduce((sum, p) => sum + p.maintenanceFee, 0));
    const fees = round(transactionFee + maintenanceFee);
    const balance = chunk[chunk.length - 1].balance;
    const realBalance = chunk[chunk.length - 1].realBalance;

    grouped.push({
      period: grouped.length + 1,
      contribution,
      interest,
      transactionFee,
      maintenanceFee,
      fees,
      balance,
      realBalance,
    });
  }

  return grouped;
}

function calculateFee(amount: number, type: FeeType, value: number): number {
  if (amount <= 0 || value <= 0) return 0;

  const fee = type === 'percentage' ? amount * (value / 100) : value;

  return round(Math.min(fee, amount));
}

function isMissedPeriod(period: number, totalPeriods: number, missedPeriods: number): boolean {
  if (missedPeriods <= 0 || totalPeriods <= 0) return false;

  const capped = Math.min(missedPeriods, totalPeriods);
  const missedUpToHere = Math.floor((period * capped) / totalPeriods);
  const missedBeforeHere = Math.floor(((period - 1) * capped) / totalPeriods);

  // distribui os períodos falhados uniformemente ao longo do prazo,
  // em vez de os concentrar no início ou no fim (o que enviesaria o resultado)
  return missedUpToHere > missedBeforeHere;
}

function interpolateValue(start: number, end: number, progress: number): number {
  // interpolação geométrica (assume crescimento composto contínuo entre os dois pontos reais);
  // cai para linear se a base não for positiva, para evitar NaN em Math.pow
  if (start <= 0 || end <= 0) {
    return start + (end - start) * progress;
  }

  return start * Math.pow(end / start, progress);
}

function interpolatePeriods(
  periods: PeriodBreakdown[],
  initialBalance: number,
  initialRealBalance: number,
  subStepsPerPeriod: number,
): PeriodBreakdown[] {
  const result: PeriodBreakdown[] = [];
  let previousBalance = initialBalance;
  let previousRealBalance = initialRealBalance;

  for (const period of periods) {
    const subContribution = round(period.contribution / subStepsPerPeriod);
    const subTransactionFee = round(period.transactionFee / subStepsPerPeriod);
    const subMaintenanceFee = round(period.maintenanceFee / subStepsPerPeriod);
    const subFees = round(subTransactionFee + subMaintenanceFee);
    const startBalance = previousBalance;
    const startRealBalance = previousRealBalance;

    for (let step = 1; step <= subStepsPerPeriod; step++) {
      const progress = step / subStepsPerPeriod;
      const balance = round(interpolateValue(startBalance, period.balance, progress));
      const realBalance = round(interpolateValue(startRealBalance, period.realBalance, progress));
      const priorBalance = result.length > 0 ? result[result.length - 1].balance : startBalance;
      const interest = round(balance - priorBalance - subContribution + subFees);

      result.push({
        period: result.length + 1,
        contribution: subContribution,
        interest,
        transactionFee: subTransactionFee,
        maintenanceFee: subMaintenanceFee,
        fees: subFees,
        balance,
        realBalance,
      });
    }

    previousBalance = period.balance;
    previousRealBalance = period.realBalance;
  }

  return result;
}

export function computeCompoundInterest(inputs: CompoundInterestInputs): CompoundInterestResult {
  const {
    initialInvestment,
    term,
    additionalInvestment,
    compoundingFrequency,
    interestRate,
    interestRatePeriod,
    transactionFeeType,
    transactionFeeValue,
    maintenanceFeeType,
    maintenanceFeeValue,
    missedPeriods,
    inflationRate,
  } = inputs;

  const nominalAnnualRate = (interestRate / 100) * RATE_PERIODS_PER_YEAR[interestRatePeriod];
  const periodRate = nominalAnnualRate / compoundingFrequency;
  const periodInflationRate = inflationRate / 100 / compoundingFrequency;
  const totalPeriods = term * compoundingFrequency;

  // taxa de manutenção percentual é sempre uma taxa nominal anual (tipo TER de fundos/corretoras),
  // proporcionada à frequência de capitalização — igual ao tratamento da taxa de juro.
  // taxa fixa não é proporcionada: já representa o custo por período (ex: 5€/mês se capitalização mensal)
  const maintenanceFeeValuePerPeriod =
    maintenanceFeeType === 'percentage' ? maintenanceFeeValue / compoundingFrequency : maintenanceFeeValue;

  const initialTransactionFee = calculateFee(initialInvestment, transactionFeeType, transactionFeeValue);
  let balance = round(initialInvestment - initialTransactionFee);
  const startingBalance = balance;
  const startingRealBalance = balance;

  const periods: PeriodBreakdown[] = [];
  let totalTransactionFeesPaid = initialTransactionFee;
  let totalMaintenanceFeesPaid = 0;
  let cumulativeInflationFactor = 1;

  for (let period = 1; period <= totalPeriods; period++) {
    const missed = isMissedPeriod(period, totalPeriods, missedPeriods);
    const grossContribution = missed ? 0 : additionalInvestment;
    const transactionFee = calculateFee(grossContribution, transactionFeeType, transactionFeeValue);
    const netContribution = round(grossContribution - transactionFee);

    const interest = balance * periodRate;
    balance = round(balance + interest + netContribution);

    const maintenanceFee = calculateFee(balance, maintenanceFeeType, maintenanceFeeValuePerPeriod);
    balance = round(balance - maintenanceFee);

    cumulativeInflationFactor *= 1 + periodInflationRate;
    const realBalance = round(balance / cumulativeInflationFactor);

    totalTransactionFeesPaid = round(totalTransactionFeesPaid + transactionFee);
    totalMaintenanceFeesPaid = round(totalMaintenanceFeesPaid + maintenanceFee);

    periods.push({
      period,
      contribution: round(grossContribution),
      interest: round(interest),
      transactionFee,
      maintenanceFee,
      fees: round(transactionFee + maintenanceFee),
      balance,
      realBalance,
    });
  }

  // cada período de capitalização representa 12 / compoundingFrequency meses;
  // a granularidade que corresponde a essa cadência é "nativa" (pontos reais),
  // as outras duas são interpoladas para se poder mostrar sempre mensal/trimestral/anual
  const monthsPerPeriod = 12 / compoundingFrequency;

  let monthly: PeriodBreakdown[];
  let quarterly: PeriodBreakdown[];
  let yearly: PeriodBreakdown[];
  let nativeGranularity: BreakdownGranularity;

  if (monthsPerPeriod === 1) {
    nativeGranularity = 'monthly';
    monthly = periods;
    quarterly = groupPeriods(periods, 3);
    yearly = groupPeriods(periods, 12);
  } else if (monthsPerPeriod === 3) {
    nativeGranularity = 'quarterly';
    quarterly = periods;
    monthly = interpolatePeriods(periods, startingBalance, startingRealBalance, 3);
    yearly = groupPeriods(periods, 4);
  } else {
    nativeGranularity = 'yearly';
    yearly = periods;
    quarterly = interpolatePeriods(periods, startingBalance, startingRealBalance, 4);
    monthly = interpolatePeriods(periods, startingBalance, startingRealBalance, 12);
  }

  const totalContributions = round(periods.reduce((sum, p) => sum + p.contribution, 0));
  const totalInterestEarned = round(periods.reduce((sum, p) => sum + p.interest, 0));
  const totalFeesPaid = round(totalTransactionFeesPaid + totalMaintenanceFeesPaid);
  const finalBalance = periods.length > 0 ? periods[periods.length - 1].balance : startingBalance;
  const finalBalanceReal = periods.length > 0 ? periods[periods.length - 1].realBalance : startingRealBalance;

  return {
    summary: {
      totalInvested: round(initialInvestment + totalContributions),
      totalContributions,
      totalInterestEarned,
      totalTransactionFeesPaid,
      totalMaintenanceFeesPaid,
      totalFeesPaid,
      finalBalance,
      finalBalanceReal,
    },
    breakdown: { monthly, quarterly, yearly },
    nativeGranularity,
  };
}
