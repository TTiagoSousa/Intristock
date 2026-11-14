import type { Chart_Trade } from '../../../../Hooks/Trading/useSimulationChart';
import { chartExitKeyOf } from '../Trading_Simulator/labels';

export const ALL = 'all';

// O que está escolhido: a regra de entrada ("1", "2"…) e a saída (stop_loss, signal:1…)
export interface Trade_Filter_Value {
  entry: string;
  exit: string;
}

export const NO_FILTER: Trade_Filter_Value = { entry: ALL, exit: ALL };

/** Os trades que passam o filtro, pela ordem em que vêm. */
export const filterTrades = (trades: Chart_Trade[], filter: Trade_Filter_Value) =>
  trades.filter(
    (trade) =>
      (filter.entry === ALL || String(trade.entryRule) === filter.entry) &&
      (filter.exit === ALL || chartExitKeyOf(trade) === filter.exit),
  );
