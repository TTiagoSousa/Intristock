import { useTranslation } from 'react-i18next';
import type { Order_Types, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import { entriesOf } from '../Trading_Simulator/simulationForm';
import Factsheet_Explain from './Factsheet_Explain';

interface Factsheet_Order_Types_Props {
  table: Order_Types;
  run: Simulation_Run;
}

// As moedas que se mostram como $
const DOLLAR_QUOTES = ['USDT', 'USDC', 'USD'];

/**
 * 2.3 — Resultado por tipo de ordem: a mercado, limite (o nível a favor do
 * preço) e stop (rompimento), com os trades, a espera em velas até executar, o
 * win rate, o profit factor, a expectancy (P&L médio) e o slippage pago.
 */
const Factsheet_Order_Types = ({ table, run }: Factsheet_Order_Types_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const unit = DOLLAR_QUOTES.includes(run.instrument.quote) ? '$' : run.instrument.quote;

  // O limite fica abaixo do preço nas compras e acima nas vendas; com as duas, sem lado
  const sides = new Set(
    entriesOf(run.strategy)
      .filter((entry) => (entry.price?.kind ?? 'market') !== 'market')
      .map((entry) => entry.side),
  );
  const limitKey = sides.size === 1 ? (sides.has('long') ? 'limit_below' : 'limit_above') : 'limit';

  const number = (value: number, digits = 0) => formatNumber(value, language, digits);
  const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${number(Math.abs(value), 2)} ${unit}`;
  const tone = (value: number) => (value > 0 ? 'Positive' : value < 0 ? 'Negative' : '');

  return (
    <div className="Factsheet_Panel">
      <div className="Factsheet_Panel_Header">
        <div className="Factsheet_Panel_Heading">
          <span className="Factsheet_Panel_Title">
            {t('trading.fsOrderTypesTitle')}
            <Factsheet_Explain id="setupOrderTypes" title={t('trading.fsOrderTypesTitle')} />
          </span>
          <span className="Factsheet_Panel_Note">{t('trading.fsOrderTypesNote')}</span>
        </div>
      </div>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsOrderTypesKind')}</th>
              <th className="Numeric">{t('trading.fsOrderTypesTrades')}</th>
              <th className="Numeric">{t('trading.fsOrderTypesWait')}</th>
              <th className="Numeric">{t('trading.fsOrderTypesWinRate')}</th>
              <th className="Numeric">{t('trading.fsOrderTypesPf')}</th>
              <th className="Numeric">{t('trading.fsOrderTypesExpectancy')}</th>
              <th className="Numeric">{t('trading.fsOrderTypesSlippage')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.kind}>
                <td>{t(`trading.fsOrderKind_${row.kind === 'limit' ? limitKey : row.kind}`)}</td>
                <td className="Numeric">{number(row.trades)}</td>
                <td className="Numeric">{t('trading.fsBarsValue', { value: number(row.avgWaitBars, 1) })}</td>
                <td className="Numeric">{`${number(row.winRatePct, 1)}%`}</td>
                <td className="Numeric">{row.profitFactor == null ? '—' : number(row.profitFactor, 2)}</td>
                <td className={`Numeric ${tone(row.expectancy)}`}>{signed(row.expectancy)}</td>
                <td className="Numeric">{`${number(row.slippage)} ${unit}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Factsheet_Order_Types;
