import { useTranslation } from 'react-i18next';
import type { Sample_Metric, Sample_Split } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';

interface Factsheet_Sample_Split_Props {
  table: Sample_Split;
  unit: string;
}

/**
 * 3.1 — Dentro vs fora da amostra: cada métrica nas duas partes do período e a
 * degradação ((fora − dentro) ÷ |dentro|), que o simulador já calculou. A maior
 * queda vem negativa, por isso uma degradação positiva é sempre melhor fora.
 */
const Factsheet_Sample_Split = ({ table, unit }: Factsheet_Sample_Split_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const outside = table.outOfSamplePct;

  const number = (value: number, digits: number) => formatNumber(value, language, digits);
  const signed = (value: number, digits: number) =>
    `${value > 0 ? '+' : value < 0 ? '−' : ''}${number(Math.abs(value), digits)}`;
  const plain = (value: number, digits: number) => `${value < 0 ? '−' : ''}${number(Math.abs(value), digits)}`;
  const tone = (value: number | null) => (value == null ? '' : value > 0 ? 'Positive' : value < 0 ? 'Negative' : '');

  const format = (key: Sample_Metric, value: number | null) => {
    if (value == null) return '—';
    switch (key) {
      case 'trades':
        return number(value, 0);
      case 'winRatePct':
        return `${number(value, 1)}%`;
      case 'profit':
        return `${signed(value, 0)} ${unit}`;
      case 'profitFactor':
        return number(value, 2);
      case 'sharpe':
        return plain(value, 2);
      case 'expectancyR':
        return `${signed(value, 2)}R`;
      default:
        return `${signed(value, 1)}%`;
    }
  };

  return (
    <div className="Factsheet_Panel">
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsSampleMetric')}</th>
              <th className="Numeric">{t('trading.fsSampleInside', { pct: number(100 - outside, 0) })}</th>
              <th className="Numeric">{t('trading.fsSampleOutside', { pct: number(outside, 0) })}</th>
              <th className="Numeric">{t('trading.fsSampleDegradation')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.key}>
                <td>{t(`trading.fsSample_${row.key}`)}</td>
                <td className="Numeric">{format(row.key, row.inside)}</td>
                <td className="Numeric">{format(row.key, row.outside)}</td>
                <td className={`Numeric ${tone(row.degradationPct)}`}>
                  {row.degradationPct == null ? '—' : `${plain(row.degradationPct, 0)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Factsheet_Sample_Split;
