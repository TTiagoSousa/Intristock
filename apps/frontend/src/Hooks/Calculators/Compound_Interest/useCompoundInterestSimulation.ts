import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import http from '../../../Service/httpService';
import { End_Points } from '../../../Service/endPoints';
import { useAlert } from '../../../Contexts/Alert_Context';
import { useAsyncRequest } from '../../useAsyncRequest';
import type { CompoundInterestInputs, CompoundInterestResult, FeeType } from './compoundInterest.types';

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

  const simulate = async () => {
    const response = await runSimulate(() =>
      http.post(End_Points.Compound_Interest_Simulate_Endpoint(), buildPayload()),
    );

    if (response) setResult(response.data);
  };

  const save = async () => {
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
