import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Chart_Trade } from '../../../../Hooks/Trading/useSimulationChart';
import type { Entry_Payload } from '../../../../Hooks/Trading/useSimulation';
import { entryLabel, chartExitKeyOf, exitLabel } from '../Trading_Simulator/labels';
import { ALL, NO_FILTER, filterTrades } from './tradeFilter';
import type { Trade_Filter_Value } from './tradeFilter';

interface Trade_Filter_Props {
  trades: Chart_Trade[];
  entries: Entry_Payload[];
  value: Trade_Filter_Value;
  onChange: (value: Trade_Filter_Value) => void;
}

/**
 * Os filtros no painel do seletor: as entradas e as saídas que aconteceram,
 * cada uma com quantos trades. Escolher uma deixa no gráfico (e no seletor) só
 * esses.
 */
const Trade_Filter = ({ trades, entries, value, onChange }: Trade_Filter_Props) => {
  const { t } = useTranslation();

  const entryChips = useMemo(() => {
    const counts = new Map<number, number>();
    for (const trade of trades) counts.set(trade.entryRule, (counts.get(trade.entryRule) ?? 0) + 1);
    return [...counts]
      .sort(([a], [b]) => a - b)
      .map(([rule, count]) => ({ value: String(rule), label: entryLabel(entries, rule, t), count }));
  }, [trades, entries, t]);

  // As saídas contam-se dentro da entrada escolhida
  const byEntry = useMemo(
    () => (value.entry === ALL ? trades : trades.filter((trade) => String(trade.entryRule) === value.entry)),
    [trades, value.entry],
  );
  const exitChips = useMemo(() => {
    const chips = new Map<string, { label: string; count: number; tone: string }>();
    for (const trade of byEntry) {
      const key = chartExitKeyOf(trade);
      const chip = chips.get(key);
      if (chip) chip.count += 1;
      else chips.set(key, { label: exitLabel(entries, trade.entryRule, key, t), count: 1, tone: trade.exitReason });
    }
    return [...chips].map(([key, chip]) => ({ value: key, ...chip }));
  }, [byEntry, entries, t]);

  const shown = filterTrades(trades, value).length;
  const filtered = value.entry !== ALL || value.exit !== ALL;

  return (
    <div className="Trade_Filter">
      <div className="Trade_Filter_Group">
        <span className="Trade_Picker_Group_Title">{t('trading.entryRule')}</span>
        <div className="Trade_Picker_Chips">
          <button
            type="button"
            className={`Trade_Picker_Chip${value.entry === ALL ? ' Active' : ''}`}
            // Outra entrada pode não ter a saída escolhida
            onClick={() => onChange({ entry: ALL, exit: ALL })}
          >
            {t('trading.pickerAll')}
            <span className="Trade_Picker_Chip_Count">{trades.length}</span>
          </button>
          {entryChips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              className={`Trade_Picker_Chip${value.entry === chip.value ? ' Active' : ''}`}
              onClick={() => onChange({ entry: chip.value, exit: ALL })}
            >
              {chip.label}
              <span className="Trade_Picker_Chip_Count">{chip.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="Trade_Filter_Group">
        <span className="Trade_Picker_Group_Title">{t('trading.chartExit')}</span>
        <div className="Trade_Picker_Chips">
          <button
            type="button"
            className={`Trade_Picker_Chip${value.exit === ALL ? ' Active' : ''}`}
            onClick={() => onChange({ ...value, exit: ALL })}
          >
            {t('trading.pickerAll')}
            <span className="Trade_Picker_Chip_Count">{byEntry.length}</span>
          </button>
          {exitChips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              className={`Trade_Picker_Chip Tone_${chip.tone}${value.exit === chip.value ? ' Active' : ''}`}
              onClick={() => onChange({ ...value, exit: chip.value })}
            >
              {chip.label}
              <span className="Trade_Picker_Chip_Count">{chip.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="Trade_Filter_Summary">
        <span>{t('trading.chartShowing', { shown, total: trades.length })}</span>
        {filtered && (
          <button type="button" className="Trade_Filter_Clear" onClick={() => onChange(NO_FILTER)}>
            {t('trading.clearFilter')}
          </button>
        )}
      </div>
    </div>
  );
};

export default Trade_Filter;
