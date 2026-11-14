import { useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import type { Instrument_Type } from './useMarketInstruments';
import { isActiveStatus } from './useSimulation';
import type { Run_Progress_Info, Run_Status, Timeframe } from './useSimulation';

// Uma linha da lista: o resumo do resultado, sem a estratégia
export interface Simulation_Run_Item {
  id: string;
  timeframe: Timeframe;
  fromDate: string;
  toDate: string;
  status: Run_Status;
  progress: number;
  progressInfo: Run_Progress_Info | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  // 3.7: a simulação original, quando esta é a mesma estratégia noutro mercado
  sourceRunId: string | null;
  instrument: {
    source: string;
    type: Instrument_Type;
    symbol: string;
    quote: string;
    asset: { ticker: string | null };
  };
  download: {
    status: Run_Status;
    monthsDone: number;
    monthsTotal: number;
    currentMonth: string | null;
    startedAt: string | null;
  };
  result: {
    netProfitPct: number;
    trades: number;
    winRate: number | null;
    maxDrawdownPct: number;
    buyHoldPct: number;
  } | null;
}

export const SIMULATIONS_PAGE_SIZE = 5;

// Até quantas simulações se comparam de uma vez (uma cor de entrada para cada)
export const COMPARE_MAX = 6;

// Enquanto houver alguma na fila ou a correr, a página volta a pedir a lista
const POLL_MS = 3000;

const isActive = (run: Simulation_Run_Item) => isActiveStatus(run.status);

/** Pode cancelar-se: na fila ou a correr (a cancelar já foi pedida). */
export const canCancelRun = (run: { status: Run_Status }) => run.status === 'queued' || run.status === 'running';

/**
 * Cancela uma simulação (POST /simulations/:id/cancel): na fila fica logo
 * cancelada, a correr fica a cancelar até o simulador a parar. Dá nulo se
 * cancelou, ou o motivo do backend (vazio se não disse nenhum).
 */
export const cancelSimulation = async (id: string): Promise<string | null> => {
  try {
    await http.post(End_Points.Simulation_Cancel_Endpoint(id));
    return null;
  } catch (error) {
    const message = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
    return Array.isArray(message) ? message.join(', ') : (message ?? '');
  }
};

/**
 * Apaga simulações (POST /simulations/delete). Dá nulo se apagou, ou o motivo
 * do backend (vazio se não disse nenhum).
 */
export const deleteSimulations = async (ids: string[]): Promise<string | null> => {
  try {
    await http.post(End_Points.Simulations_Delete_Endpoint(), { ids });
    return null;
  } catch (error) {
    const message = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
    return Array.isArray(message) ? message.join(', ') : (message ?? '');
  }
};

/**
 * As simulações do utilizador, das mais recentes para as mais antigas, dez de
 * cada vez.
 *
 * O "a carregar" é derivado (a página pedida ainda não é a carregada) em vez
 * de um setState dentro do efeito.
 */
export const useSimulations = (page: number) => {
  const [result, setResult] = useState<{
    page: number;
    version: number;
    items: Simulation_Run_Item[];
    total: number;
  } | null>(null);
  // Sobe ao apagar: pede a página outra vez já, sem esconder a lista que está
  const [version, setVersion] = useState(0);

  const current = result?.page === page ? result : null;
  const fresh = result?.version === version;
  // Muda a cada resposta só enquanto há alguma a correr: é isso que agenda o
  // pedido seguinte
  const pollKey = current?.items.some(isActive) ? current : null;

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(
      () => {
        http
          .get(End_Points.Simulations_Endpoint(), {
            params: { skip: (page - 1) * SIMULATIONS_PAGE_SIZE, take: SIMULATIONS_PAGE_SIZE },
          })
          .then((response) => {
            if (!cancelled) setResult({ page, version, ...response.data });
          })
          .catch(() => {
            if (!cancelled) setResult({ page, version, items: [], total: 0 });
          });
      },
      current && fresh ? POLL_MS : 0,
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Sem nada a correr, a lista carregada fica como está
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pollKey, version]);

  return {
    runs: current?.items ?? [],
    total: current?.total ?? 0,
    totalPages: Math.max(1, Math.ceil((current?.total ?? 0) / SIMULATIONS_PAGE_SIZE)),
    loading: !current,
    reload: () => setVersion((value) => value + 1),
  };
};
