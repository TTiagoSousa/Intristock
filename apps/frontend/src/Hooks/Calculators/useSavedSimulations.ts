import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { getErrorMessage, useAsyncRequest } from '../useAsyncRequest';

export interface SavedSimulation {
  id: string;
  calculator: { abbreviation: string; name: string };
  inputs: Record<string, unknown>;
  result: Record<string, unknown>;
  createdAt: string;
}

/** As simulações guardadas de todas as calculadoras, a mais recente primeiro. */
export const useSavedSimulations = () => {
  const [simulations, setSimulations] = useState<SavedSimulation[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { loading, run } = useAsyncRequest(true);
  const { setAlert } = useAlert();
  const { t } = useTranslation();

  // A lista só muda quando a resposta chega (no callback, não no efeito)
  const fetchSimulations = () =>
    run(() => http.get<SavedSimulation[]>(End_Points.Saved_Simulations_Endpoint())).then((response) => {
      if (response) setSimulations(response.data);
    });

  const deleteSimulation = async (id: string) => {
    setDeletingId(id);

    try {
      await http.delete(End_Points.Saved_Simulation_Endpoint(id));

      setSimulations((current) => current.filter((simulation) => simulation.id !== id));
      setAlert({ open: true, message: t('calculators.simulationDeleted'), type: 'success' });
    } catch (error) {
      setAlert({ open: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchSimulations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { simulations, loading, deleteSimulation, deletingId };
};
