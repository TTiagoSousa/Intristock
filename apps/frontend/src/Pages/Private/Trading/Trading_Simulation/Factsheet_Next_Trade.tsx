import { useTranslation } from 'react-i18next';
import type { Next_Trade } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Panel from './Factsheet_Panel';
import { useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Next_Trade_Props {
  table: Next_Trade;
  unit: string;
}

/**
 * 4.8 — O trade seguinte: como se comporta um trade conforme o que aconteceu
 * antes dele (um ganho, uma perda, um stop, dois ganhos ou duas perdas
 * seguidas), com a probabilidade de se repetir. Tudo vem calculado.
 */
const Factsheet_Next_Trade = ({ table, unit }: Factsheet_Next_Trade_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat(unit);

  return (
    <Factsheet_Panel title={t('trading.fsNextTitle')} explain="entryNextTrade" note={t('trading.fsNextNote')}>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsNextCol_after')}</th>
              <th className="Numeric">{t('trading.fsNextCol_trades')}</th>
              <th className="Numeric">{t('trading.fsNextCol_winRate')}</th>
              <th className="Numeric">{t('trading.fsNextCol_avgR')}</th>
              <th className="Numeric">{t('trading.fsNextCol_pnl')}</th>
              <th className="Numeric">{t('trading.fsNextCol_repeat')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.after}>
                <td className="Strong">{t(`trading.fsNextAfter_${row.after}`)}</td>
                <td className="Numeric">{f.number(row.trades)}</td>
                <td className="Numeric">{f.percent(row.winRatePct, 0)}</td>
                <td className={`Numeric Strong ${f.tone(row.avgR)}`}>{f.r(row.avgR)}</td>
                <td className={`Numeric ${f.tone(row.pnl)}`}>{f.money(row.pnl)}</td>
                <td className="Numeric">{f.percent(row.repeatPct, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Factsheet_Panel>
  );
};

export default Factsheet_Next_Trade;
