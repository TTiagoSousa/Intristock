import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Order_Variant, Order_Variants, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import { fromRun } from '../Trading_Simulator/simulationForm';
import { valueLabel } from '../Trading_Simulator/valueLabels';
import Factsheet_Explain from './Factsheet_Explain';

interface Factsheet_Order_Variants_Props {
  table: Order_Variants;
  run: Simulation_Run;
}

/**
 * 2.3 — Variantes da ordem de cada entrada que entra por nível: a estratégia
 * corrida outra vez pelo simulador, só com a ordem dessa entrada mudada. Os
 * trades, as ordens executadas e caídas são dessa entrada; o retorno e o Δ (em
 * p.p., contra a atual) são da estratégia toda.
 */
const Factsheet_Order_Variants = ({ table, run }: Factsheet_Order_Variants_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const form = useMemo(() => fromRun(run), [run]);

  const number = (value: number, digits = 0) => formatNumber(value, language, digits);
  const signed = (value: number, digits: number) =>
    `${value > 0 ? '+' : value < 0 ? '−' : ''}${number(Math.abs(value), digits)}`;
  const tone = (value: number | null) => (value == null ? '' : value > 0 ? 'Positive' : value < 0 ? 'Negative' : '');

  const label = (variant: Order_Variant, price: string) => {
    const text = variant.market
      ? t('trading.fsVariantMarket', {
          execution: t(`trading.execution_${run.strategy.executionPrice ?? 'open'}`).toLowerCase(),
        })
      : [
          price,
          t('trading.shBars', { count: variant.orderBars }),
          variant.orderBars > 1 ? t(`trading.fsVariantTrack_${variant.orderTrack ? 'yes' : 'no'}`) : null,
          variant.orderBars > 1 && variant.orderCancel ? t('trading.shOrderCancels') : null,
        ]
          .filter(Boolean)
          .join(' · ');
    return variant.current ? `${text} ${t('trading.fsVariantCurrent')}` : text;
  };

  return table.entries.map((item) => {
    const entry = form.entries[item.rule - 1];
    const name = entry?.name.trim() || t('trading.entryTitle', { position: item.rule });
    const price = entry ? valueLabel(entry.price, form.indicators, t) : '';
    return (
      <div key={item.rule} className="Factsheet_Panel">
        <div className="Factsheet_Panel_Header">
          <div className="Factsheet_Panel_Heading">
            <span className="Factsheet_Panel_Title">
              {t('trading.fsVariantsTitle', { name })}
              <Factsheet_Explain id="setupOrderVariants" title={t('trading.fsVariantsTitle', { name })} />
            </span>
            <span className="Factsheet_Panel_Note">{t('trading.fsVariantsNote')}</span>
          </div>
        </div>
        <div className="Factsheet_Table_Scroll">
          <table className="Factsheet_Table Factsheet_Variants">
            <thead>
              <tr>
                <th>{t('trading.fsVariantsOrder')}</th>
                <th className="Numeric">{t('trading.fsVariantsTrades')}</th>
                <th className="Numeric">{t('trading.fsVariantsFilled')}</th>
                <th className="Numeric">{t('trading.fsVariantsExpired')}</th>
                <th className="Numeric">{t('trading.fsVariantsReturn')}</th>
                <th className="Numeric">Δ</th>
              </tr>
            </thead>
            <tbody>
              {item.variants.map((variant, index) => (
                <tr key={index} className={variant.current ? 'Current' : undefined}>
                  <td>{label(variant, price)}</td>
                  <td className="Numeric">{number(variant.trades)}</td>
                  <td className="Numeric">{number(variant.filled)}</td>
                  <td className="Numeric">{number(variant.expired)}</td>
                  <td className={`Numeric ${tone(variant.returnPct)}`}>
                    {variant.returnPct == null ? '—' : `${signed(variant.returnPct, 1)}%`}
                  </td>
                  <td className={`Numeric ${tone(variant.deltaPp)}`}>
                    {variant.deltaPp == null ? '—' : t('trading.fsPpValue', { value: signed(variant.deltaPp, 1) })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  });
};

export default Factsheet_Order_Variants;
