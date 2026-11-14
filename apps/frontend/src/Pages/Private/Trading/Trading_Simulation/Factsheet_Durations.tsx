import { useTranslation } from 'react-i18next';
import type { Duration_Buckets } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Panel from './Factsheet_Panel';
import { useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Durations_Props {
  table: Duration_Buckets;
  unit: string;
}

/**
 * 4.5 — Duração × resultado: por intervalo de velas abertas, os trades, a win
 * rate, a expectancy, o R médio, a % de stops e o P&L.
 */
const Factsheet_Durations = ({ table, unit }: Factsheet_Durations_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat(unit);

  const label = (from: number, to: number | null, first: boolean) => {
    const range = to == null ? `${f.number(from)}+` : `${f.number(from)} – ${f.number(to)}`;
    return first ? t('trading.fsDurationFirst', { range }) : range;
  };

  return (
    <Factsheet_Panel title={t('trading.fsDurationTitle')} explain="entryDurations">
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsDurationCol_duration')}</th>
              <th className="Numeric">{t('trading.fsDurationCol_trades')}</th>
              <th className="Numeric">{t('trading.fsDurationCol_winRate')}</th>
              <th className="Numeric">{t('trading.fsDurationCol_expectancy')}</th>
              <th className="Numeric">{t('trading.fsDurationCol_avgR')}</th>
              <th className="Numeric">{t('trading.fsDurationCol_stops')}</th>
              <th className="Numeric">{t('trading.fsDurationCol_pnl')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={row.fromBars}>
                <td>{label(row.fromBars, row.toBars, index === 0)}</td>
                <td className="Numeric">{f.number(row.trades)}</td>
                <td className="Numeric">{f.percent(row.winRatePct)}</td>
                <td className={`Numeric ${f.tone(row.expectancy)}`}>{f.money(row.expectancy, 2)}</td>
                <td className="Numeric">{f.r(row.avgR)}</td>
                <td className="Numeric">{f.percent(row.stopsPct, 0)}</td>
                <td className={`Numeric ${f.tone(row.pnl)}`}>{f.money(row.pnl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Factsheet_Panel>
  );
};

export default Factsheet_Durations;
