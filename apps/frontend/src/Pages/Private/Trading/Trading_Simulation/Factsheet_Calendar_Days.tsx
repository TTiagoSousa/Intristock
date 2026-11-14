import { useTranslation } from 'react-i18next';
import type {
  Calendar_Best_Days,
  Calendar_Entry_Count,
  Calendar_Stop_Days,
  Entry_Payload,
} from '../../../../Hooks/Trading/useSimulation';
import { entryLabel } from '../Trading_Simulator/labels';
import Factsheet_Panel from './Factsheet_Panel';
import { useFactsheetFormat } from './factsheetFormat';

type Factsheet_Calendar_Days_Props = { entries: Entry_Payload[]; unit: string } & (
  | { kind: 'stops'; table: Calendar_Stop_Days }
  | { kind: 'best'; table: Calendar_Best_Days }
);

// "2026-04-13" → "13/04/2026"
const dateLabel = (date: string) => date.split('-').reverse().join('/');

/**
 * 5.5 — Os dias com mais stops (pelo dia em que fecharam, com as entradas
 * atingidas) e os melhores dias (com a parte do lucro total e as entradas dos
 * trades fechados nesse dia). O P&L do dia é o da equity. Tudo vem calculado.
 */
const Factsheet_Calendar_Days = (props: Factsheet_Calendar_Days_Props) => {
  const { kind, entries, unit } = props;
  const { t } = useTranslation();
  const f = useFactsheetFormat(unit);
  // Uma entrada por linha
  const names = (list: Calendar_Entry_Count[]) =>
    list.length
      ? list.map((item) => (
          <span key={item.rule} className="Factsheet_Calendar_Entry">
            {entryLabel(entries, item.rule, t)} ×{item.count}
          </span>
        ))
      : '—';
  const stops = kind === 'stops';
  const count = props.table.rows.length;

  return (
    <Factsheet_Panel
      title={t(stops ? 'trading.fsCalendarStopDaysTitle' : 'trading.fsCalendarBestDaysTitle', { count })}
      note={t(stops ? 'trading.fsCalendarStopDaysNote' : 'trading.fsCalendarBestDaysNote')}
      explain={stops ? 'hoursCalStopDays' : 'hoursCalBestDays'}
    >
      {count ? (
        <div className="Factsheet_Table_Scroll">
          <table className="Factsheet_Table">
            <thead>
              <tr>
                <th>{t('trading.fsCalendarCol_date')}</th>
                <th>{t('trading.fsWeekdayCol_day')}</th>
                {stops ? (
                  <>
                    <th className="Numeric">{t('trading.fsHourCol_stops')}</th>
                    <th className="Numeric">{t('trading.fsHourCol_trades')}</th>
                  </>
                ) : (
                  <>
                    <th className="Numeric">{t('trading.fsHourCol_trades')}</th>
                    <th className="Numeric">{t('trading.fsHourCol_stops')}</th>
                  </>
                )}
                <th className="Numeric">{t('trading.fsCalendarCol_pnl')}</th>
                {!stops && <th className="Numeric">{t('trading.fsCalendarCol_profitPct')}</th>}
                <th>{t(stops ? 'trading.fsCalendarCol_stopEntries' : 'trading.fsCalendarCol_entries')}</th>
              </tr>
            </thead>
            <tbody>
              {props.kind === 'stops'
                ? props.table.rows.map((row) => (
                    <tr key={row.date}>
                      <td className="Strong">{dateLabel(row.date)}</td>
                      <td>{t(`trading.fsWeekday_${row.weekday}`)}</td>
                      <td className="Numeric Negative">{f.number(row.stops)}</td>
                      <td className="Numeric">{f.number(row.trades)}</td>
                      <td className={`Numeric Strong ${f.tone(row.pnl)}`}>{f.money(row.pnl)}</td>
                      <td>{names(row.entries)}</td>
                    </tr>
                  ))
                : props.table.rows.map((row) => (
                    <tr key={row.date}>
                      <td className="Strong">{dateLabel(row.date)}</td>
                      <td>{t(`trading.fsWeekday_${row.weekday}`)}</td>
                      <td className="Numeric">{f.number(row.trades)}</td>
                      <td className={`Numeric ${row.stops ? 'Negative' : ''}`}>{f.number(row.stops)}</td>
                      <td className={`Numeric Strong ${f.tone(row.pnl)}`}>{f.money(row.pnl)}</td>
                      <td className="Numeric">{f.percent(row.profitPct, 1)}</td>
                      <td>{names(row.entries)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      ) : (
        <span className="Factsheet_Hint">{t(stops ? 'trading.fsCalendarNoStops' : 'trading.fsCalendarNoGains')}</span>
      )}
    </Factsheet_Panel>
  );
};

export default Factsheet_Calendar_Days;
