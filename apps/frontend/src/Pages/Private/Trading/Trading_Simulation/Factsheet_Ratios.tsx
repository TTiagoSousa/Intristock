import { useTranslation } from 'react-i18next';
import type { Ratio_Rating, Table_Risk_Ratios } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';

interface Factsheet_Ratios_Props {
  table: Table_Risk_Ratios;
}

// A cor da leitura: a favor na cor da marca, contra a vermelho
const RATING_TONE: Record<Ratio_Rating, string> = {
  weak: 'Negative',
  noEdge: 'Negative',
  good: 'Positive',
  veryGood: 'Positive Strong',
  excellent: 'Positive Strong',
};

/**
 * 1.5 — Rácios ajustados ao risco: cada rácio com o valor, o do buy & hold (onde
 * existe), a fórmula, a referência (dos níveis que o simulador usou) e a leitura.
 * Tudo vem calculado; aqui só se desenha.
 */
const Factsheet_Ratios = ({ table }: Factsheet_Ratios_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  const number = (value: number | null, key: string) => {
    if (value == null) return '—';
    const text = `${value < 0 ? '−' : ''}${formatNumber(Math.abs(value), language, key === 'kelly' ? 1 : 2)}`;
    return key === 'kelly' ? `${text}%` : text;
  };
  // Os níveis só com as casas que têm (1,5 e não 1,50)
  const level = (value: number | undefined) => {
    if (value == null) return '';
    const digits = Number.isInteger(value) ? 0 : Number.isInteger(value * 10) ? 1 : 2;
    return formatNumber(value, language, digits);
  };

  return (
    <div className="Factsheet_Panel Plain">
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsRatioName')}</th>
              <th className="Numeric">{t('trading.fsRatioValue')}</th>
              <th className="Numeric">{t('trading.fsRatioBuyHold')}</th>
              <th>{t('trading.fsRatioFormula')}</th>
              <th>{t('trading.fsRatioReference')}</th>
              <th>{t('trading.fsRatioReading')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => {
              const levels = table.levels[row.key] ?? {};
              return (
                <tr key={row.key}>
                  <td>{t(`trading.fsRatio_${row.key}`)}</td>
                  <td className="Numeric">{number(row.value, row.key)}</td>
                  <td className="Numeric">{number(row.buyHold, row.key)}</td>
                  <td className="Factsheet_Table_Wrap">{t(`trading.fsRatioFormula_${row.key}`, { max: table.sqnMaxTrades })}</td>
                  <td>
                    {t(`trading.fsRatioRef_${row.key}`, {
                      good: level(levels.good),
                      veryGood: level(levels.veryGood),
                      excellent: level(levels.excellent),
                    })}
                  </td>
                  <td className={row.rating ? RATING_TONE[row.rating] : undefined}>
                    {row.rating ? t(`trading.fsRatioRating_${row.rating}`) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Factsheet_Ratios;
