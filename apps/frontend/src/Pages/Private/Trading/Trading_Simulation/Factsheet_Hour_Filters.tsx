import { useTranslation } from 'react-i18next';
import type { Hour_Filter_Row, Hour_Filters } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Panel from './Factsheet_Panel';
import { hourLabel, useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Hour_Filters_Props {
  table: Hour_Filters;
}

/**
 * 5.8 — Os filtros de horário: cada um escolhido só com a parte dentro da
 * amostra e corrido no motor com as horas ou os dias juntos aos horários
 * bloqueados. Os sinais bloqueados, trades, stops, retorno, maior queda, o Δ
 * contra a estratégia atual e o retorno dentro e fora da amostra (e o Δ fora).
 * Tudo vem calculado.
 */
const Factsheet_Hour_Filters = ({ table }: Factsheet_Hour_Filters_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat('');
  const hours = (list: number[]) => list.map(hourLabel).join(', ');
  const days = (list: number[]) => list.map((day) => t(`trading.fsWeekday_${day}`)).join(', ');

  // Como se configura: as horas e os dias que vão para os horários bloqueados
  const setup = (row: Hour_Filter_Row) => {
    if (row.filter === 'current') return t('trading.fsFilterSetup_current');
    if (row.filter === 'bestHours') return t('trading.fsFilterSetup_keep', { hours: hours(row.keep) });
    if (row.filter === 'exitStopHour')
      return t('trading.fsFilterSetup_exitStop', { before: hourLabel(row.hours[0]), hour: hourLabel(row.hours[row.hours.length - 1]) });
    const parts = [];
    if (row.hours.length) parts.push(t('trading.fsFilterSetup_hours', { hours: hours(row.hours) }));
    if (row.days.length) parts.push(t('trading.fsFilterSetup_days', { days: days(row.days) }));
    return parts.join(' · ');
  };
  const delta = (value: number | null, current: boolean) =>
    current ? '—' : value == null ? '—' : t('trading.fsFilterPoints', { value: f.signed(value, 1) });

  return (
    <Factsheet_Panel title={t('trading.fsFiltersTitle')} explain="hoursFilters" note={t(table.configured ? 'trading.fsFiltersNote' : 'trading.fsFiltersNoteDefault')}>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsFiltersCol_filter')}</th>
              <th>{t('trading.fsFiltersCol_setup')}</th>
              <th className="Numeric">{t('trading.fsFiltersCol_signals')}</th>
              <th className="Numeric">{t('trading.fsHourCol_trades')}</th>
              <th className="Numeric">{t('trading.fsHourCol_stops')}</th>
              <th className="Numeric">{t('trading.fsFiltersCol_return')}</th>
              <th className="Numeric">{t('trading.fsFiltersCol_maxDd')}</th>
              <th className="Numeric">{t('trading.fsFiltersCol_delta')}</th>
              <th className="Numeric">{t('trading.fsFiltersCol_inside')}</th>
              <th className="Numeric">{t('trading.fsFiltersCol_outside')}</th>
              <th className="Numeric">{t('trading.fsFiltersCol_deltaOut')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => {
              const current = row.filter === 'current';
              return (
                <tr key={row.filter}>
                  <td className="Strong">{t(`trading.fsFilter_${row.filter}`)}</td>
                  <td className="Factsheet_Table_Wrap">{setup(row)}</td>
                  <td className="Numeric">{f.number(row.signalsBlocked)}</td>
                  <td className="Numeric">{f.number(row.trades)}</td>
                  <td className={`Numeric ${row.stops ? 'Negative' : ''}`}>{f.number(row.stops)}</td>
                  <td className={`Numeric Strong ${f.tone(row.returnPct)}`}>{f.signedPercent(row.returnPct)}</td>
                  <td className="Numeric Negative">{f.signedPercent(row.maxDrawdownPct)}</td>
                  <td className={`Numeric ${current ? '' : f.tone(row.deltaPct)}`}>{delta(row.deltaPct, current)}</td>
                  <td className={`Numeric ${f.tone(row.inReturnPct)}`}>{f.signedPercent(row.inReturnPct)}</td>
                  <td className={`Numeric Strong ${f.tone(row.outReturnPct)}`}>{f.signedPercent(row.outReturnPct)}</td>
                  <td className={`Numeric ${current ? '' : f.tone(row.deltaOutPct)}`}>{delta(row.deltaOutPct, current)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Factsheet_Panel>
  );
};

export default Factsheet_Hour_Filters;
