import { useTranslation } from 'react-i18next';
import type { Entry_Payload, Exit_Hour_Entries } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Entry_Name from './Factsheet_Entry_Name';
import Factsheet_Panel from './Factsheet_Panel';
import { hourLabel, useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Exit_Hour_Table_Props {
  table: Exit_Hour_Entries;
  entries: Entry_Payload[];
}

/**
 * 5.2 — Entrada → hora de saída: para cada entrada, as três horas em que mais
 * levou stop, as horas médias de entrada e de saída desses stops, a hora com
 * mais saídas a ganhar, os stops na 1.ª hora e os de madrugada. Tudo calculado.
 */
const Factsheet_Exit_Hour_Table = ({ table, entries }: Factsheet_Exit_Hour_Table_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat('');
  const hour = (value: number | null | undefined) => (value == null ? '—' : hourLabel(value));
  // Um número e a parte que é dos stops da entrada: "1 (9%)"
  const share = (count: number, pct: number | null) => (pct == null ? '—' : `${f.number(count)} (${f.percent(pct, 0)})`);
  const night = table.nightHours;
  const nightRange = night.length ? `${hourLabel(night[0])}–${hourLabel(night[night.length - 1] + 1)}` : '';

  return (
    <Factsheet_Panel title={t('trading.fsExitHourTableTitle')} explain="hoursExitTable" note={t('trading.fsExitHourTableNote')}>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsExitHourCol_entry')}</th>
              <th className="Numeric">{t('trading.fsExitHourCol_stops')}</th>
              <th>{t('trading.fsExitHourCol_topStops')}</th>
              <th className="Numeric">{t('trading.fsExitHourCol_avgEntry')}</th>
              <th className="Numeric">{t('trading.fsExitHourCol_avgExit')}</th>
              <th>{t('trading.fsExitHourCol_topWin')}</th>
              <th className="Numeric">{t('trading.fsExitHourCol_firstHour')}</th>
              <th className="Numeric">{t('trading.fsExitHourCol_night', { range: nightRange })}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.rule}>
                <td className="Strong">
                  <Factsheet_Entry_Name entries={entries} rule={row.rule} />
                </td>
                <td className={`Numeric Strong ${row.stops ? 'Negative' : ''}`}>{f.number(row.stops)}</td>
                <td>
                  {row.topStopHours.length
                    ? row.topStopHours.map((item) => `${hourLabel(item.hour)} (${f.number(item.stops)})`).join(', ')
                    : '—'}
                </td>
                <td className="Numeric">{hour(row.avgEntryHour)}</td>
                <td className="Numeric">{hour(row.avgExitHour)}</td>
                <td>{row.topWinHour ? `${hourLabel(row.topWinHour.hour)} (${f.number(row.topWinHour.trades)})` : '—'}</td>
                <td className="Numeric">{share(row.firstHourStops, row.firstHourPct)}</td>
                <td className="Numeric">{share(row.nightStops, row.nightPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <span className="Factsheet_Panel_Footnote">{t('trading.fsExitHourTableFootnote')}</span>
    </Factsheet_Panel>
  );
};

export default Factsheet_Exit_Hour_Table;
