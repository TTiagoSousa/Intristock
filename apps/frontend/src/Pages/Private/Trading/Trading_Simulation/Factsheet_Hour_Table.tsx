import { useTranslation } from 'react-i18next';
import type { Entry_Payload, Hour_Table } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Entry_Name from './Factsheet_Entry_Name';
import Factsheet_Panel from './Factsheet_Panel';
import { hourLabel, useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Hour_Table_Props {
  table: Hour_Table;
  entries: Entry_Payload[];
  unit: string;
}

/**
 * 5.1 — Por hora de entrada: uma linha por hora (as 24, as vazias com traços)
 * com a sessão do mercado, os trades, os lados, os stops, o P&L, a expectancy,
 * o R médio, as velas e a entrada que mais abriu nessa hora. Tudo vem calculado.
 */
const Factsheet_Hour_Table = ({ table, entries, unit }: Factsheet_Hour_Table_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat(unit);

  return (
    <Factsheet_Panel title={t('trading.fsHourTableTitle')} explain="hoursTable" note={t('trading.fsHourTableNote')}>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsHourCol_hour')}</th>
              <th>{t('trading.fsHourCol_session')}</th>
              <th className="Numeric">{t('trading.fsHourCol_trades')}</th>
              <th className="Numeric">{t('trading.fsHourCol_pct')}</th>
              <th className="Numeric">{t('trading.fsHourCol_sides')}</th>
              <th className="Numeric">{t('trading.fsHourCol_winRate')}</th>
              <th className="Numeric">{t('trading.fsHourCol_stops')}</th>
              <th className="Numeric">{t('trading.fsHourCol_stopsPct')}</th>
              <th className="Numeric">{t('trading.fsHourCol_pnl')}</th>
              <th className="Numeric">{t('trading.fsHourCol_expectancy')}</th>
              <th className="Numeric">{t('trading.fsHourCol_avgR')}</th>
              <th className="Numeric">{t('trading.fsHourCol_bars')}</th>
              <th>{t('trading.fsHourCol_topEntry')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => {
              const empty = row.trades === 0;
              return (
                <tr key={row.hour}>
                  <td className="Strong">{hourLabel(row.hour)}</td>
                  <td>{t(`trading.fsHourSession_${row.session}`)}</td>
                  <td className="Numeric">{f.number(row.trades)}</td>
                  <td className="Numeric">{f.percent(row.pct, 1)}</td>
                  <td className="Numeric">{empty ? '—' : `${f.number(row.longs)} / ${f.number(row.shorts)}`}</td>
                  <td className="Numeric">{f.percent(row.winRatePct, 0)}</td>
                  <td className="Numeric">{empty ? '—' : f.number(row.stops)}</td>
                  <td className="Numeric">{f.percent(row.stopsPct, 0)}</td>
                  <td className={`Numeric Strong ${empty ? '' : f.tone(row.pnl)}`}>{empty ? '—' : f.money(row.pnl)}</td>
                  <td className={`Numeric ${f.tone(row.expectancy)}`}>{f.money(row.expectancy, 2)}</td>
                  <td className={`Numeric ${f.tone(row.avgR)}`}>{f.r(row.avgR)}</td>
                  <td className="Numeric">{f.number(row.avgBars, 1)}</td>
                  <td>
                    {row.topEntry ? (
                      <>
                        <Factsheet_Entry_Name entries={entries} rule={row.topEntry.rule} /> ({f.number(row.topEntry.trades)})
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Factsheet_Panel>
  );
};

export default Factsheet_Hour_Table;
