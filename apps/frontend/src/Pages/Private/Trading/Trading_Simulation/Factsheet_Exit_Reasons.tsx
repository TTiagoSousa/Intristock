import { useTranslation } from 'react-i18next';
import type { Entry_Payload, Exit_Reasons } from '../../../../Hooks/Trading/useSimulation';
import { exitColumnLabel } from '../Trading_Simulator/labels';
import Factsheet_Panel from './Factsheet_Panel';
import { exitColorClass, useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Exit_Reasons_Props {
  table: Exit_Reasons;
  entries: Entry_Payload[];
  unit: string;
}

/**
 * 4.3 — Por motivo de saída (as colunas da 4.2): trades, % deles, win rate, P&L
 * médio e total, velas e o deixado na mesa (MFE médio − movimento até à saída).
 */
const Factsheet_Exit_Reasons = ({ table, entries, unit }: Factsheet_Exit_Reasons_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat(unit);

  return (
    <Factsheet_Panel title={t('trading.fsReasonsTitle')} explain="entryExitReasons">
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsReasonsCol_exit')}</th>
              <th className="Numeric">{t('trading.fsReasonsCol_trades')}</th>
              <th className="Numeric">%</th>
              <th className="Numeric">{t('trading.fsReasonsCol_winRate')}</th>
              <th className="Numeric">{t('trading.fsReasonsCol_avgPnl')}</th>
              <th className="Numeric">{t('trading.fsReasonsCol_pnl')}</th>
              <th className="Numeric">{t('trading.fsReasonsCol_bars')}</th>
              <th className="Numeric">{t('trading.fsReasonsCol_left')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => {
              const column = table.columns[index];
              return (
                <tr key={row.key}>
                  <td>
                    <span className="Factsheet_By_Entry_Name">
                      <span className={`Factsheet_Legend_Square ${exitColorClass(column.reason)}`} />
                      {exitColumnLabel(entries, column, t, f.language)}
                    </span>
                  </td>
                  <td className="Numeric">{f.number(row.trades)}</td>
                  <td className="Numeric">{f.percent(row.pct, 0)}</td>
                  <td className="Numeric">{f.percent(row.winRatePct, 0)}</td>
                  <td className={`Numeric ${f.tone(row.avgPnl)}`}>{f.money(row.avgPnl, 2)}</td>
                  <td className={`Numeric Strong ${f.tone(row.pnl)}`}>{f.money(row.pnl)}</td>
                  <td className="Numeric">{f.number(row.avgBars, 1)}</td>
                  <td className="Numeric">{f.percent(row.leftOnTablePct, 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="Factsheet_Panel_Footnote">{t('trading.fsReasonsFootnote')}</p>
    </Factsheet_Panel>
  );
};

export default Factsheet_Exit_Reasons;
