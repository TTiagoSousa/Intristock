import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import http from '../../../Service/httpService';
import { End_Points } from '../../../Service/endPoints';
import { useAlert } from '../../../Contexts/Alert_Context';
import { getErrorMessage, useAsyncRequest } from '../../useAsyncRequest';
import type { CompoundInterestInputs, CompoundInterestResult } from './compoundInterest.types';

export interface SavedCompoundInterestSimulation {
  id: string;
  inputs: CompoundInterestInputs;
  result: CompoundInterestResult;
  createdAt: string;
}

export const useSavedCompoundInterestSimulations = () => {
  const [savedSimulations, setSavedSimulations] = useState<SavedCompoundInterestSimulation[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { loading, run } = useAsyncRequest(true);
  const { setAlert } = useAlert();
  const { t } = useTranslation();

  const fetchSavedSimulations = async () => {
    const response = await run(() => http.get(End_Points.Compound_Interest_Saved_Endpoint()));

    if (response) setSavedSimulations(response.data);
  };

  const deleteSimulation = async (id: string) => {
    setDeletingId(id);

    try {
      await http.delete(End_Points.Compound_Interest_Delete_Endpoint(id));

      setSavedSimulations((current) => current.filter((simulation) => simulation.id !== id));
      setAlert({ open: true, message: t('compoundInterest.simulationDeleted'), type: 'success' });
    } catch (error: any) {
      setAlert({ open: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchSavedSimulations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { savedSimulations, loading, refresh: fetchSavedSimulations, deleteSimulation, deletingId };
};
