import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Table_Monthly_Detail } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';

interface Factsheet_Monthly_Detail_Props {
  table: Table_Monthly_Detail;
  // Como se escreve a moeda cotada ("$")
  quoteLabel: string;
}

/**
 * 1.3 — Mês a mês (a vista avançada dos retornos): trades, win rate, stops e
 * takes, P&L bruto, comissões, funding e P&L líquido, o retorno e a maior queda
 * do mês e o capital no fim. Tudo vem calculado; aqui só se desenha.
 */
const Factsheet_Monthly_Detail = ({ table, quoteLabel }: Factsheet_Monthly_Detail_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  // "Jan 2020", na língua da app
  const monthName = useMemo(() => {
    const format = new Intl.DateTimeFormat(language, { month: 'short', timeZone: 'UTC' });
    return (year: number, month: number) => {
      const name = format.format(new Date(Date.UTC(year, month - 1, 1))).replace('.', '');
      return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
    };
  }, [language]);

  const sign = (value: number) => (value > 0 ? '+' : value < 0 ? '−' : '');
  const tone = (value: number) => (value > 0 ? 'Positive' : value < 0 ? 'Negative' : '');
  const money = (value: number, signed = true) =>
    `${signed ? sign(value) : value < 0 ? '−' : ''}${formatNumber(Math.abs(value), language, 0)} ${quoteLabel}`;
  const percent = (value: number) => `${sign(value)}${formatNumber(Math.abs(value), language, 1)}%`;

  return (
    <div className="Factsheet_Table_Scroll Factsheet_Monthly_Scroll">
      <table className="Factsheet_Table Factsheet_Monthly">
        <thead>
          <tr>
            <th>{t('trading.fsMonthlyMonth')}</th>
            <th className="Numeric">{t('trading.fsMonthlyTrades')}</th>
            <th className="Numeric">{t('trading.fsMonthlyWinRate')}</th>
            <th className="Numeric">{t('trading.fsMonthlyStops')}</th>
            <th className="Numeric">{t('trading.fsMonthlyTakes')}</th>
            <th className="Numeric">{t('trading.fsMonthlyGross')}</th>
            <th className="Numeric">{t('trading.fsMonthlyFees')}</th>
            <th className="Numeric">{t('trading.fsMonthlyFunding')}</th>
            <th className="Numeric">{t('trading.fsMonthlyNet')}</th>
            <th className="Numeric">{t('trading.fsMonthlyReturn')}</th>
            <th className="Numeric">{t('trading.fsMonthlyMaxDrawdown')}</th>
            <th className="Numeric">{t('trading.fsMonthlyEndCapital')}</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={`${row.year}-${row.month}`}>
              <td className={row.partial ? 'Partial' : undefined} title={row.partial ? t('trading.fsReturnsPartial') : undefined}>
                {monthName(row.year, row.month)}
              </td>
              <td className="Numeric">{formatNumber(row.trades, language, 0)}</td>
              <td className="Numeric">{row.winRatePct == null ? '—' : `${formatNumber(row.winRatePct, language, 0)}%`}</td>
              <td className="Numeric">{formatNumber(row.stops, language, 0)}</td>
              <td className="Numeric">{formatNumber(row.takes, language, 0)}</td>
              <td className={`Numeric ${tone(row.grossPnl)}`}>{money(row.grossPnl)}</td>
              <td className="Numeric">{money(row.fees, false)}</td>
              <td className="Numeric">{money(row.funding, false)}</td>
              <td className={`Numeric ${tone(row.netPnl)}`}>{money(row.netPnl)}</td>
              <td className={`Numeric ${tone(row.returnPct)}`}>{percent(row.returnPct)}</td>
              <td className={`Numeric ${tone(-row.maxDrawdownPct)}`}>{percent(-row.maxDrawdownPct)}</td>
              <td className="Numeric">{money(row.endCapital, false)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Factsheet_Monthly_Detail;
