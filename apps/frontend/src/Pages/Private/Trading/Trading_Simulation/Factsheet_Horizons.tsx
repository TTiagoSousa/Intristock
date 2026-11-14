import { useTranslation } from 'react-i18next';
import type { Table_Horizon_Returns } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import Factsheet_Explain from './Factsheet_Explain';

interface Factsheet_Horizons_Props {
  table: Table_Horizon_Returns;
}

/**
 * 1.3 — Por horizonte: nos últimos meses e anos e no período todo, a estratégia
 * contra comprar e manter no mesmo intervalo, a diferença, a maior queda e os
 * trades. Tudo vem calculado; aqui só se desenha.
 */
const Factsheet_Horizons = ({ table }: Factsheet_Horizons_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  const sign = (value: number) => (value > 0 ? '+' : value < 0 ? '−' : '');
  const tone = (value: number) => (value > 0 ? 'Positive' : value < 0 ? 'Negative' : '');
  const percent = (value: number) => `${sign(value)}${formatNumber(Math.abs(value), language, 1)}%`;
  const points = (value: number) => `${sign(value)}${formatNumber(Math.abs(value), language, 1)} p.p.`;

  return (
    <div className="Factsheet_Panel">
      <div className="Factsheet_Panel_Header">
        <div className="Factsheet_Panel_Heading">
          <span className="Factsheet_Panel_Title">
            {t('trading.fsHorizonTitle')}
            <Factsheet_Explain id="sumHorizons" title={t('trading.fsHorizonTitle')} />
          </span>
          <span className="Factsheet_Panel_Note">{t('trading.fsHorizonNote')}</span>
        </div>
      </div>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsHorizonPeriod')}</th>
              <th className="Numeric">{t('trading.fsHorizonStrategy')}</th>
              <th className="Numeric">{t('trading.fsHorizonBuyHold')}</th>
              <th className="Numeric">{t('trading.fsHorizonDifference')}</th>
              <th className="Numeric">{t('trading.fsHorizonMaxDrawdown')}</th>
              <th className="Numeric">{t('trading.fsHorizonTrades')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.key} className={row.key === 'all' ? 'Total' : undefined}>
                <td>{t(`trading.fsHorizon_${row.key}`, { days: formatNumber(row.days, language, 0) })}</td>
                <td className={`Numeric ${tone(row.strategyPct)}`}>{percent(row.strategyPct)}</td>
                <td className={`Numeric ${tone(row.buyHoldPct)}`}>{percent(row.buyHoldPct)}</td>
                <td className={`Numeric ${tone(row.differencePp)}`}>{points(row.differencePp)}</td>
                <td className={`Numeric ${tone(-row.maxDrawdownPct)}`}>{percent(-row.maxDrawdownPct)}</td>
                <td className="Numeric">{formatNumber(row.trades, language, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Factsheet_Horizons;
