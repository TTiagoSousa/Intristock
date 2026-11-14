import { useTranslation } from 'react-i18next';
import type { Entry_Payload, Weekday_Table } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Entry_Name from './Factsheet_Entry_Name';
import Factsheet_Panel from './Factsheet_Panel';
import { useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Weekday_Table_Props {
  table: Weekday_Table;
  entries: Entry_Payload[];
  unit: string;
}

/**
 * 5.3 — Por dia da semana: uma linha por dia (pelo dia em que o trade abriu)
 * com os trades e a média por dia, win rate, stops (dos abertos e os atingidos
 * nesse dia), P&L, expectancy, R médio, velas, a pior sequência de stops e a
 * melhor e a pior entrada. Tudo vem calculado.
 */
const Factsheet_Weekday_Table = ({ table, entries, unit }: Factsheet_Weekday_Table_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat(unit);
  const warn = (value: number) => (value > 0 ? 'Negative' : '');

  const entry = (value: { rule: number; pnl: number } | null) =>
    value ? (
      <span className="Factsheet_Weekday_Entry">
        <Factsheet_Entry_Name entries={entries} rule={value.rule} />
        <span className={f.tone(value.pnl)}>{f.money(value.pnl)}</span>
      </span>
    ) : (
      '—'
    );

  return (
    <Factsheet_Panel title={t('trading.fsWeekdayTableTitle')} explain="hoursDayTable" note={t('trading.fsWeekdayTableNote')}>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsWeekdayCol_day')}</th>
              <th className="Numeric">{t('trading.fsHourCol_trades')}</th>
              <th className="Numeric">{t('trading.fsWeekdayCol_perDay')}</th>
              <th className="Numeric">{t('trading.fsHourCol_winRate')}</th>
              <th className="Numeric">{t('trading.fsHourCol_stops')}</th>
              <th className="Numeric">{t('trading.fsHourCol_stopsPct')}</th>
              <th className="Numeric">{t('trading.fsWeekdayCol_exitStops')}</th>
              <th className="Numeric">{t('trading.fsHourCol_pnl')}</th>
              <th className="Numeric">{t('trading.fsHourCol_expectancy')}</th>
              <th className="Numeric">{t('trading.fsHourCol_avgR')}</th>
              <th className="Numeric">{t('trading.fsHourCol_bars')}</th>
              <th className="Numeric">{t('trading.fsWeekdayCol_streak')}</th>
              <th>{t('trading.fsWeekdayCol_bestEntry')}</th>
              <th>{t('trading.fsWeekdayCol_worstEntry')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => {
              const empty = row.trades === 0;
              return (
                <tr key={row.day}>
                  <td className="Strong">{t(`trading.fsWeekday_${row.day}`)}</td>
                  <td className="Numeric">{f.number(row.trades)}</td>
                  <td className="Numeric">{f.number(row.perDay, 2)}</td>
                  <td className="Numeric">{f.percent(row.winRatePct, 0)}</td>
                  <td className={`Numeric ${warn(row.stops)}`}>{empty ? '—' : f.number(row.stops)}</td>
                  <td className={`Numeric ${warn(row.stops)}`}>{f.percent(row.stopsPct, 0)}</td>
                  <td className={`Numeric ${warn(row.exitStops)}`}>{f.number(row.exitStops)}</td>
                  <td className={`Numeric Strong ${empty ? '' : f.tone(row.pnl)}`}>{empty ? '—' : f.money(row.pnl)}</td>
                  <td className={`Numeric ${f.tone(row.expectancy)}`}>{f.money(row.expectancy, 2)}</td>
                  <td className={`Numeric ${f.tone(row.avgR)}`}>{f.r(row.avgR)}</td>
                  <td className="Numeric">{f.number(row.avgBars, 1)}</td>
                  <td className="Numeric">{empty ? '—' : f.number(row.worstStreak)}</td>
                  <td>{entry(row.bestEntry)}</td>
                  <td>{entry(row.worstEntry)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="Factsheet_Panel_Footnote">{t('trading.fsWeekdayTableFootnote')}</p>
    </Factsheet_Panel>
  );
};

export default Factsheet_Weekday_Table;
