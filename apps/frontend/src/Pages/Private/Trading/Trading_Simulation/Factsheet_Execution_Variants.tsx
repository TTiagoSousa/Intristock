import { useTranslation } from 'react-i18next';
import type { Execution_Variants } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import Factsheet_Explain from './Factsheet_Explain';

interface Factsheet_Execution_Variants_Props {
  table: Execution_Variants;
}

/**
 * 2.3 — Preço de execução das ordens a mercado: a estratégia corrida pelo
 * simulador com cada preço (abertura da vela, fecho da vela anterior, preço
 * médio do primeiro minuto), a atual primeiro. O Δ é a diferença de retorno em
 * p.p. contra a atual: a sensibilidade ao preço de entrada.
 */
const Factsheet_Execution_Variants = ({ table }: Factsheet_Execution_Variants_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  const number = (value: number, digits = 0) => formatNumber(value, language, digits);
  const signed = (value: number, digits: number) =>
    `${value > 0 ? '+' : value < 0 ? '−' : ''}${number(Math.abs(value), digits)}`;
  const tone = (value: number | null) => (value == null ? '' : value > 0 ? 'Positive' : value < 0 ? 'Negative' : '');

  return (
    <div className="Factsheet_Panel">
      <div className="Factsheet_Panel_Header">
        <div className="Factsheet_Panel_Heading">
          <span className="Factsheet_Panel_Title">
            {t('trading.fsExecutionTitle')}
            <Factsheet_Explain id="setupExecution" title={t('trading.fsExecutionTitle')} />
          </span>
          <span className="Factsheet_Panel_Note">{t('trading.fsExecutionNote')}</span>
        </div>
      </div>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table Factsheet_Variants">
          <thead>
            <tr>
              <th>{t('trading.fsExecutionPrice')}</th>
              <th className="Numeric">{t('trading.fsExecutionTrades')}</th>
              <th className="Numeric">{t('trading.fsExecutionWinRate')}</th>
              <th className="Numeric">{t('trading.fsExecutionPf')}</th>
              <th className="Numeric">{t('trading.fsExecutionReturn')}</th>
              <th className="Numeric">{t('trading.fsExecutionMaxDd')}</th>
              <th className="Numeric">Δ</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.mode} className={row.current ? 'Current' : undefined}>
                <td>
                  {row.current
                    ? `${t(`trading.fsExecution_${row.mode}`)} ${t('trading.fsVariantCurrent')}`
                    : t(`trading.fsExecution_${row.mode}`)}
                </td>
                <td className="Numeric">{number(row.trades)}</td>
                <td className="Numeric">{row.winRatePct == null ? '—' : `${number(row.winRatePct, 1)}%`}</td>
                <td className="Numeric">{row.profitFactor == null ? '—' : number(row.profitFactor, 2)}</td>
                <td className={`Numeric ${tone(row.returnPct)}`}>
                  {row.returnPct == null ? '—' : `${signed(row.returnPct, 1)}%`}
                </td>
                <td className={`Numeric ${row.maxDrawdownPct ? 'Negative' : ''}`}>
                  {row.maxDrawdownPct == null ? '—' : `${signed(-row.maxDrawdownPct, 1)}%`}
                </td>
                <td className={`Numeric ${tone(row.deltaPp)}`}>
                  {row.deltaPp == null ? '—' : t('trading.fsPpValue', { value: signed(row.deltaPp, 1) })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Factsheet_Execution_Variants;
