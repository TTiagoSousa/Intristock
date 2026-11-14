import { useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import type { Simulation_Run_Item } from './useSimulations';
import { isActiveStatus } from './useSimulation';
import type { Verdict_Overall } from './useSimulation';

// Uma simulação da família (a original ou a mesma estratégia noutro mercado)
export interface Market_Run_Item extends Simulation_Run_Item {
  instrumentId: string;
  verdict: Verdict_Overall | null;
}

// Enquanto houver alguma na fila ou a correr, volta a pedir a família
const POLL_MS = 3000;

const isActive = (run: Market_Run_Item) => isActiveStatus(run.status);

const errorMessage = (error: unknown) => {
  const message = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join(', ') : (message ?? null);
};

/**
 * 3.7 — A mesma estratégia noutros mercados: a família de uma simulação (GET
 * /simulations/:id/markets) e correr noutros (POST, com os instrumentos). A
 * família volta a pedir-se enquanto alguma está na fila ou a correr.
 */
export const useMarketRuns = (runId: string) => {
  const [result, setResult] = useState<{ runId: string; items: Market_Run_Item[] } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = result?.runId === runId ? result : null;
  const pollKey = current?.items.some(isActive) ? current : null;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(
      () => {
        http
          .get<{ sourceRunId: string; items: Market_Run_Item[] }>(End_Points.Simulation_Markets_Endpoint(runId))
          .then((response) => {
            if (!cancelled) setResult({ runId, items: response.data.items });
          })
          .catch(() => {
            if (!cancelled) setResult({ runId, items: [] });
          });
      },
      pollKey ? POLL_MS : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [runId, pollKey, refresh]);

  const create = async (instrumentIds: string[]) => {
    setCreating(true);
    setError(null);
    try {
      await http.post(End_Points.Simulation_Markets_Endpoint(runId), { instrumentIds });
      setRefresh((value) => value + 1);
      return true;
    } catch (requestError) {
      setError(errorMessage(requestError));
      return false;
    } finally {
      setCreating(false);
    }
  };

  return { runs: current?.items ?? [], loading: !current, create, creating, error };
};
