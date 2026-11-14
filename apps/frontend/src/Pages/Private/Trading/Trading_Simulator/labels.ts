import type { TFunction } from 'i18next';
import type { Entry_Payload, Simulation_Trade } from '../../../../Hooks/Trading/useSimulation';

/**
 * Os nomes das entradas e das saídas nos resumos e na lista de trades: o que o
 * utilizador escreveu ou, sem nome, "Entrada 1", "Stop loss", "Saída 2"…
 */

// A saída de um trade como o resumo a identifica: stop_loss, take_profit, signal:N ou end
export const exitKeyOf = (trade: Pick<Simulation_Trade, 'exitReason' | 'exitRule'>) =>
  trade.exitReason === 'signal' && trade.exitRule ? `signal:${trade.exitRule}` : trade.exitReason;

// No gráfico, um stop que um ajuste (stopRules) mexeu tem a sua saída: stop_loss@2 (o ajuste 2)
export const chartExitKeyOf = (trade: Pick<Simulation_Trade, 'exitReason' | 'exitRule'>) =>
  ['stop_loss', 'trailing_stop', 'break_even'].includes(trade.exitReason) && trade.exitRule
    ? `${trade.exitReason}@${trade.exitRule}`
    : exitKeyOf(trade);

export const entryLabel = (entries: Entry_Payload[], rule: number, t: TFunction) =>
  entries[rule - 1]?.name || t('trading.entryTitle', { position: rule });

export const exitLabel = (entries: Entry_Payload[], rule: number, exit: string, t: TFunction) => {
  const entry = entries[rule - 1];
  if (exit.includes('@')) {
    const [reason, adjust] = exit.split('@');
    return `${t(`trading.exit_${reason}`)} · ${t('trading.fsExitAdjust', { position: Number(adjust) })}`;
  }
  if (exit === 'stop_loss') return entry?.stopLossName || t('trading.exit_stop_loss');
  if (exit === 'take_profit') return entry?.takeProfitName || t('trading.exit_take_profit');
  if (exit.startsWith('signal:')) {
    const position = Number(exit.split(':')[1]);
    return entry?.exits?.[position - 1]?.name || t('trading.exitTitle', { position });
  }
  // signal sem número (simulações antigas) e o fim do período
  return t(`trading.exit_${exit}`);
};

// A classe da cor do distintivo: a da razão (signal:2 → signal)
export const exitTone = (exit: string) => exit.split(/[:@]/)[0];

// As colunas de saída da página Entradas e saídas (stop_loss:2.5, signal:1.2…)
interface Exit_Column_Like {
  reason: string;
  value: number | null;
  rule: number | null;
  exit: number | null;
  adjust?: number | null;
  rules: number[];
}

// O nome que as entradas dessa coluna deram a esta saída, se todas lhe deram o mesmo
const sharedName = (entries: Entry_Payload[], rules: number[], pick: (entry: Entry_Payload) => string | null | undefined) => {
  const names = rules.map((rule) => entries[rule - 1] && pick(entries[rule - 1]));
  return names.length && names[0] && names.every((name) => name === names[0]) ? names[0] : null;
};

/**
 * O nome de uma coluna de saída: o que o utilizador escreveu (se todas as entradas
 * dela lhe deram o mesmo) ou "Stop 2%", "Alvo 5%", "Trailing 2,5%", "Tempo 36 velas";
 * as condições pelo nome da saída da entrada.
 */
export const exitColumnLabel = (entries: Entry_Payload[], column: Exit_Column_Like, t: TFunction, language: string) => {
  // Um stop que um ajuste (stopRules) mexeu: "Stop loss · ajuste 2" (e a entrada, se houver mais do que uma)
  if (column.adjust && column.rule) {
    const label = `${t(`trading.exit_${column.reason}`)} · ${t('trading.fsExitAdjust', { position: column.adjust })}`;
    return entries.length > 1 ? `${entryLabel(entries, column.rule, t)} · ${label}` : label;
  }
  const value = column.value == null ? '' : column.value.toLocaleString(language, { maximumFractionDigits: 2 });
  // O stop na mínima/máxima ou num nível e o take em R não têm uma % (vem sem valor)
  const plain = (reason: string, key: string) =>
    column.value == null ? t(`trading.exit_${reason}`) : t(key, { value });
  switch (column.reason) {
    case 'stop_loss':
      return (
        sharedName(entries, column.rules, (entry) => entry.stopLossName) ||
        plain('stop_loss', 'trading.fsExitColumn_stop_loss')
      );
    case 'take_profit':
      return (
        sharedName(entries, column.rules, (entry) => entry.takeProfitName) ||
        plain('take_profit', 'trading.fsExitColumn_take_profit')
      );
    case 'trailing_stop':
    case 'break_even':
    case 'time':
      return column.value == null ? t(`trading.exit_${column.reason}`) : t(`trading.fsExitColumn_${column.reason}`, { value });
    case 'signal':
      return column.rule && column.exit ? exitLabel(entries, column.rule, `signal:${column.exit}`, t) : t('trading.exit_signal');
    default:
      return t(`trading.exit_${column.reason}`);
  }
};
