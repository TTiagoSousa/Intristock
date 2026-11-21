import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import http from '../../../Service/httpService';
import { End_Points } from '../../../Service/endPoints';
import { useAlert } from '../../../Contexts/Alert_Context';
import { useAsyncRequest } from '../../useAsyncRequest';
import type { CompoundInterestInputs, CompoundInterestResult, FeeType } from './compoundInterest.types';

// Os mesmos limites do backend (create-compound-interest-simulation.dto.ts)
export const COMPOUND_LIMITS = {
  amount: { min: 0, max: 1e12 },
  term: { min: 1, max: 100 },
  interestRate: { min: -100, max: 1000 },
  inflationRate: { min: 0, max: 1000 },
  missedPeriods: { min: 0, max: 1200 },
} as const;

export const useCompoundInterestSimulation = (onSaved?: () => void) => {
  const [initialInvestment, setInitialInvestment] = useState('');
  const [term, setTerm] = useState('');
  const [additionalInvestment, setAdditionalInvestment] = useState('');
  const [compoundingFrequency, setCompoundingFrequency] = useState('12');
  const [interestRate, setInterestRate] = useState('');
  const [interestRatePeriod, setInterestRatePeriod] = useState('annual');
  const [transactionFeeType, setTransactionFeeType] = useState<FeeType>('percentage');
  const [transactionFeeValue, setTransactionFeeValue] = useState('0');
  const [maintenanceFeeType, setMaintenanceFeeType] = useState<FeeType>('percentage');
  const [maintenanceFeeValue, setMaintenanceFeeValue] = useState('0');
  const [missedPeriods, setMissedPeriods] = useState('0');
  const [inflationRate, setInflationRate] = useState('0');

  const [result, setResult] = useState<CompoundInterestResult | null>(null);

  const { loading, run: runSimulate } = useAsyncRequest();
  const { loading: saving, run: runSave } = useAsyncRequest();

  const { setAlert } = useAlert();
  const { t } = useTranslation();

  const buildPayload = () => ({
    initialInvestment: Number(initialInvestment),
    term: Number(term),
    additionalInvestment: Number(additionalInvestment),
    compoundingFrequency: Number(compoundingFrequency),
    interestRate: Number(interestRate),
    interestRatePeriod,
    transactionFeeType,
    transactionFeeValue: Number(transactionFeeValue),
    maintenanceFeeType,
    maintenanceFeeValue: Number(maintenanceFeeValue),
    missedPeriods: Number(missedPeriods),
    inflationRate: Number(inflationRate),
  });

  // Fora dos limites não se pede: diz-se qual é o campo e até onde vai
  const outOfRange = () => {
    const payload = buildPayload();
    const checks: [number, { min: number; max: number }, string][] = [
      [payload.initialInvestment, COMPOUND_LIMITS.amount, 'compoundInterest.initialInvestment'],
      [payload.term, COMPOUND_LIMITS.term, 'compoundInterest.term'],
      [payload.additionalInvestment, COMPOUND_LIMITS.amount, 'compoundInterest.additionalInvestment'],
      [payload.interestRate, COMPOUND_LIMITS.interestRate, 'compoundInterest.interestRate'],
      [payload.transactionFeeValue, COMPOUND_LIMITS.amount, 'compoundInterest.transactionFee'],
      [payload.maintenanceFeeValue, COMPOUND_LIMITS.amount, 'compoundInterest.maintenanceFee'],
      [payload.missedPeriods, COMPOUND_LIMITS.missedPeriods, 'compoundInterest.missedPeriodsField'],
      [payload.inflationRate, COMPOUND_LIMITS.inflationRate, 'compoundInterest.inflationRate'],
    ];
    const bad = checks.find(([value, range]) => Number.isFinite(value) && (value < range.min || value > range.max));
    if (!bad) return false;
    setAlert({
      open: true,
      type: 'error',
      message: t('compoundInterest.outOfRange', { field: t(bad[2]), min: bad[1].min, max: bad[1].max }),
    });
    return true;
  };

  const simulate = async () => {
    if (outOfRange()) return;
    const response = await runSimulate(() =>
      http.post(End_Points.Compound_Interest_Simulate_Endpoint(), buildPayload()),
    );

    if (response) setResult(response.data);
  };

  const save = async () => {
    if (outOfRange()) return;
    const response = await runSave(() => http.post(End_Points.Compound_Interest_Save_Endpoint(), buildPayload()));

    if (response) {
      setAlert({ open: true, message: t('compoundInterest.simulationSaved'), type: 'success' });
      onSaved?.();
    }
  };

  const loadSimulation = (inputs: CompoundInterestInputs, savedResult: CompoundInterestResult) => {
    setInitialInvestment(String(inputs.initialInvestment));
    setTerm(String(inputs.term));
    setAdditionalInvestment(String(inputs.additionalInvestment));
    setCompoundingFrequency(String(inputs.compoundingFrequency));
    setInterestRate(String(inputs.interestRate));
    setInterestRatePeriod(inputs.interestRatePeriod);
    setTransactionFeeType(inputs.transactionFeeType ?? 'percentage');
    setTransactionFeeValue(String(inputs.transactionFeeValue ?? 0));
    setMaintenanceFeeType(inputs.maintenanceFeeType ?? 'percentage');
    setMaintenanceFeeValue(String(inputs.maintenanceFeeValue ?? 0));
    setMissedPeriods(String(inputs.missedPeriods ?? 0));
    setInflationRate(String(inputs.inflationRate ?? 0));
    setResult(savedResult);
  };

  return {
    initialInvestment,
    setInitialInvestment,
    term,
    setTerm,
    additionalInvestment,
    setAdditionalInvestment,
    compoundingFrequency,
    setCompoundingFrequency,
    interestRate,
    setInterestRate,
    interestRatePeriod,
    setInterestRatePeriod,
    transactionFeeType,
    setTransactionFeeType,
    transactionFeeValue,
    setTransactionFeeValue,
    maintenanceFeeType,
    setMaintenanceFeeType,
    maintenanceFeeValue,
    setMaintenanceFeeValue,
    missedPeriods,
    setMissedPeriods,
    inflationRate,
    setInflationRate,
    result,
    loading,
    simulate,
    saving,
    save,
    loadSimulation,
  };
};
