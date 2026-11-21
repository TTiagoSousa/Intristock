import { useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import type { Simulation_Payload } from './simulationStrategy';
import type { Report_Block, Simulation_Report } from './simulationReport';
import { isActiveStatus, type Simulation_Run, type Simulation_Trade, type Trades_Options } from './simulationRun';

// Os tipos estão por área nos ficheiros ao lado; ficam também exportados daqui
export * from './simulationStrategy';
export * from './simulationReport';
export * from './simulationRun';

// O simulador grava o progresso no máximo a cada meio segundo
const POLL_MS = 1000;

export const isRunActive = (run: Simulation_Run) => isActiveStatus(run.status);

const errorMessage = (error: unknown) => {
  const message = (error as { response?: { data?: { message?: string | string[] } } }).response?.data
    ?.message;
  return Array.isArray(message) ? message.join(', ') : (message ?? null);
};

/**
 * Uma simulação, acompanhada até acabar: enquanto está na fila ou a correr,
 * volta a pedir o estado a cada segundo.
 *
 * O "a carregar" é derivado (o id pedido ainda não é o da simulação que está
 * aqui) em vez de um setState dentro do efeito.
 */
export const useSimulationRun = (runId: string | null) => {
  const [run, setRun] = useState<Simulation_Run | null>(null);
  const [missingId, setMissingId] = useState<string | null>(null);
  // Sobe quando um pedido falha a meio (o backend a reiniciar): volta a pedir
  const [retry, setRetry] = useState(0);

  const current = run && run.id === runId ? run : null;

  useEffect(() => {
    if (!runId || missingId === runId) return;
    if (current && !isRunActive(current)) return;
    let cancelled = false;

    const timer = setTimeout(
      () => {
        http
          .get(End_Points.Simulation_Endpoint(runId))
          .then((response) => {
            if (!cancelled) setRun(response.data);
          })
          .catch(() => {
            if (cancelled) return;
            // Um id antigo no URL (de outro utilizador ou apagado); a meio, tenta outra vez
            if (!current) setMissingId(runId);
            else setRetry((value) => value + 1);
          });
      },
      current ? POLL_MS : 0,
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Cada resposta nova (current) volta a agendar o pedido seguinte
  }, [runId, current, missingId, retry]);

  return {
    run: current,
    missing: Boolean(runId) && missingId === runId,
    loading: Boolean(runId) && !current && missingId !== runId,
  };
};

/**
 * Os blocos do relatório de uma simulação (GET /simulations/:id/report), só os
 * pedidos e só quando ela acabou. O "a carregar" é derivado (o que está
 * carregado é de outra simulação ou de outros blocos).
 */
export const useSimulationReport = (runId: string, blocks: Report_Block[], ready: boolean) => {
  const key = `${runId}:${blocks.join(',')}`;
  const [result, setResult] = useState<{ key: string; report: Simulation_Report | null } | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    http
      .get<Simulation_Report>(End_Points.Simulation_Report_Endpoint(runId), { params: { blocks: blocks.join(',') } })
      .then((response) => {
        if (!cancelled) setResult({ key, report: response.data });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, report: null });
      });
    return () => {
      cancelled = true;
    };
    // A chave junta a simulação e os blocos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  const current = result?.key === key ? result : null;
  return {
    report: current?.report ?? null,
    loading: ready && !current,
    failed: current !== null && current.report === null,
  };
};

export const useCreateSimulation = () => {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (payload: Simulation_Payload): Promise<Simulation_Run | null> => {
    setCreating(true);
    setError(null);
    try {
      const response = await http.post(End_Points.Simulations_Endpoint(), payload);
      return response.data;
    } catch (requestError) {
      setError(errorMessage(requestError));
      return null;
    } finally {
      setCreating(false);
    }
  };

  return { create, creating, error };
};

export const TRADES_PAGE_SIZE = 10;

// Só os trades de uma entrada e/ou de uma saída (stop_loss, take_profit, signal:N, end)
export interface Trades_Filter {
  entryRule?: number;
  exit?: string;
}

// Os trades de uma simulação acabada, dez por página
export const useSimulationTrades = (
  runId: string | null,
  page: number,
  filter: Trades_Filter = {},
  options: Trades_Options = {},
) => {
  const pageSize = options.pageSize ?? TRADES_PAGE_SIZE;
  const order = options.order ?? 'asc';
  const key = runId ? `${runId}|${page}|${filter.entryRule ?? ''}|${filter.exit ?? ''}|${pageSize}|${order}` : '';
  const [result, setResult] = useState<{ key: string; items: Simulation_Trade[]; total: number }>({
    key: '',
    items: [],
    total: 0,
  });

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;

    http
      .get(End_Points.Simulation_Trades_Endpoint(runId), {
        params: { skip: (page - 1) * pageSize, take: pageSize, order, ...filter },
      })
      .then((response) => {
        if (!cancelled) setResult({ key, ...response.data });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, items: [], total: 0 });
      });

    return () => {
      cancelled = true;
    };
    // A chave já resume o id, a página, o filtro, o tamanho e a ordem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const fresh = result.key === key;
  return {
    trades: fresh ? result.items : [],
    total: fresh ? result.total : 0,
    loading: Boolean(runId) && !fresh,
  };
};
