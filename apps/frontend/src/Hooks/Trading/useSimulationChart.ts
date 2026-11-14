import { useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import type { Simulation_Trade } from './useSimulation';

// Um trade como o gráfico o desenha
export type Chart_Trade = Pick<
  Simulation_Trade,
  | 'index'
  | 'entryRule'
  | 'side'
  | 'entryTime'
  | 'entryPrice'
  | 'exitTime'
  | 'exitPrice'
  | 'exitReason'
  | 'exitRule'
  | 'quantity'
  | 'pnlPct'
  | 'partials'
  | 'adds'
  | 'stopMoves'
>;

// As velas não vêm aqui: o gráfico pede-as aos blocos (marketCandles)
export interface Simulation_Chart {
  trades: Chart_Trade[];
}

/**
 * Os trades de uma simulação, todos, para o gráfico. O "a carregar" é derivado
 * (o que está carregado é de outra simulação) em vez de um setState dentro do
 * efeito.
 */
// Sem simulação (null, o gráfico de um teste ao vivo), não se pede nada
export const useSimulationChart = (runId: string | null) => {
  const [result, setResult] = useState<{ runId: string; chart: Simulation_Chart | null } | null>(null);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    http
      .get<Simulation_Chart>(End_Points.Simulation_Chart_Endpoint(runId))
      .then((response) => {
        if (!cancelled) setResult({ runId, chart: response.data });
      })
      .catch(() => {
        if (!cancelled) setResult({ runId, chart: null });
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const current = result?.runId === runId ? result : null;
  return {
    chart: current?.chart ?? null,
    loading: !current,
    failed: current !== null && current.chart === null,
  };
};
