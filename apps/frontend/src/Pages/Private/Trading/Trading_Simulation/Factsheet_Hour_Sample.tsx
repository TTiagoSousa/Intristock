import { useTranslation } from 'react-i18next';
import type { Hour_Filter_Sample } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Panel from './Factsheet_Panel';
import { hourLabel, useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Hour_Sample_Props {
  // 'worst': as piores horas (com a % de stops); 'best': as melhores (com o win rate)
  kind: 'worst' | 'best';
  table: Hour_Filter_Sample;
  unit: string;
}

/**
 * 5.8 — As 6 piores (ou melhores) horas pela expectancy dentro da amostra e o
 * que fizeram fora: trades, expectancy e a % de stops (ou o win rate) em cada
 * parte, e se o sinal se manteve. Tudo vem calculado.
 */
const Factsheet_Hour_Sample = ({ kind, table, unit }: Factsheet_Hour_Sample_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat(unit);
  const worst = kind === 'worst';
  const third = (value: { stopsPct: number | null; winRatePct: number | null }) =>
    f.percent(worst ? value.stopsPct : value.winRatePct, 0);

  return (
    <Factsheet_Panel
      title={t(worst ? 'trading.fsWorstHoursTitle' : 'trading.fsBestHoursTitle')}
      note={t(worst ? 'trading.fsWorstHoursNote' : 'trading.fsBestHoursNote')}
      explain={worst ? 'hoursSampleWorst' : 'hoursSampleBest'}
    >
      {table.rows.length ? (
        <div className="Factsheet_Table_Scroll">
          <table className="Factsheet_Table">
            <thead>
              <tr>
                <th>{t('trading.fsHourCol_hour')}</th>
                <th className="Numeric">{t('trading.fsSampleCol_tradesIn')}</th>
                <th className="Numeric">{t('trading.fsSampleCol_expectancyIn')}</th>
                <th className="Numeric">{t(worst ? 'trading.fsSampleCol_stopsIn' : 'trading.fsSampleCol_winRateIn')}</th>
                <th className="Numeric">{t('trading.fsSampleCol_tradesOut')}</th>
                <th className="Numeric">{t('trading.fsSampleCol_expectancyOut')}</th>
                <th className="Numeric">{t(worst ? 'trading.fsSampleCol_stopsOut' : 'trading.fsSampleCol_winRateOut')}</th>
                <th>{t('trading.fsSampleCol_holds')}</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.hour}>
                  <td className="Strong Numeric Left">{hourLabel(row.hour)}</td>
                  <td className="Numeric">{f.number(row.inside.trades)}</td>
                  <td className={`Numeric ${f.tone(row.inside.expectancy)}`}>{f.money(row.inside.expectancy, 2)}</td>
                  <td className="Numeric">{third(row.inside)}</td>
                  <td className="Numeric">{f.number(row.outside.trades)}</td>
                  <td className={`Numeric Strong ${f.tone(row.outside.expectancy)}`}>{f.money(row.outside.expectancy, 2)}</td>
                  <td className="Numeric">{third(row.outside)}</td>
                  <td className={row.holds == null ? '' : row.holds ? 'Positive' : 'Negative'}>
                    {t(row.holds == null ? 'trading.fsSampleHolds_none' : row.holds ? 'trading.fsSampleHolds_yes' : 'trading.fsSampleHolds_no')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <span className="Factsheet_Hint">{t('trading.fsSampleEmpty', { min: table.minTrades })}</span>
      )}
    </Factsheet_Panel>
  );
};

export default Factsheet_Hour_Sample;
