import { useTranslation } from 'react-i18next';
import type { Entry_Payload, Entry_Performance } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Entry_Name from './Factsheet_Entry_Name';
import { useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Entry_Table_Props {
  table: Entry_Performance;
  entries: Entry_Payload[];
  unit: string;
}

/**
 * 4.1 — Por entrada: o resumo de cada entrada, com o R médio dentro e fora da
 * amostra e o retorno da estratégia sem ela (corrida no motor). Tudo vem calculado.
 */
const Factsheet_Entry_Table = ({ table, entries, unit }: Factsheet_Entry_Table_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat(unit);

  return (
    <div className="Factsheet_Panel Plain">
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsEntCol_entry')}</th>
              <th>{t('trading.fsEntCol_side')}</th>
              <th className="Numeric">{t('trading.fsEntCol_trades')}</th>
              <th className="Numeric">{t('trading.fsEntCol_winRate')}</th>
              <th className="Numeric">{t('trading.fsEntCol_payoff')}</th>
              <th className="Numeric">{t('trading.fsEntCol_pf')}</th>
              <th className="Numeric">{t('trading.fsEntCol_expectancy')}</th>
              <th className="Numeric">{t('trading.fsEntCol_avgR')}</th>
              <th className="Numeric">{t('trading.fsEntCol_pnl')}</th>
              <th className="Numeric">{t('trading.fsEntCol_share')}</th>
              <th className="Numeric">{t('trading.fsEntCol_bars')}</th>
              <th className="Numeric">{t('trading.fsEntCol_stops')}</th>
              <th className="Numeric">{t('trading.fsEntCol_inside')}</th>
              <th className="Numeric">{t('trading.fsEntCol_outside')}</th>
              <th className="Numeric">{t('trading.fsEntCol_without')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.rule}>
                <td>
                  <Factsheet_Entry_Name entries={entries} rule={row.rule} />
                </td>
                <td className={row.side === 'long' ? 'Positive' : 'Negative'}>{t(`trading.fsEntSide_${row.side}`)}</td>
                <td className="Numeric">{f.number(row.trades)}</td>
                <td className="Numeric">{f.percent(row.winRatePct)}</td>
                <td className="Numeric">{f.number(row.payoff, 2)}</td>
                <td className="Numeric">{f.number(row.profitFactor, 2)}</td>
                <td className={`Numeric ${f.tone(row.expectancy)}`}>{f.money(row.expectancy, 2)}</td>
                <td className="Numeric">{f.r(row.avgR)}</td>
                <td className={`Numeric ${f.tone(row.pnl)}`}>{f.money(row.pnl)}</td>
                <td className="Numeric">{f.percent(row.profitSharePct, 0)}</td>
                <td className="Numeric">{f.number(row.avgBars, 1)}</td>
                <td className="Numeric">{f.percent(row.stopsPct, 0)}</td>
                <td className={`Numeric ${f.tone(row.insideR)}`}>{f.r(row.insideR)}</td>
                <td className={`Numeric ${f.tone(row.outsideR)}`}>{f.r(row.outsideR)}</td>
                <td className={`Numeric ${f.tone(row.withoutReturnPct)}`}>{f.signedPercent(row.withoutReturnPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="Factsheet_Panel_Footnote">{t('trading.fsEntFootnote')}</p>
    </div>
  );
};

export default Factsheet_Entry_Table;
