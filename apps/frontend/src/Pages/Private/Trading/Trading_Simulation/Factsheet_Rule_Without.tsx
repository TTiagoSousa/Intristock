import { useTranslation } from 'react-i18next';
import type { Rule_Without } from '../../../../Hooks/Trading/useSimulation';
import type { useFactsheetFormat } from './factsheetFormat';

type Format = ReturnType<typeof useFactsheetFormat>;

// Os cabeçalhos das colunas «sem esta regra» (a estratégia corrida sem ela) e do que ela rende
export const Rule_Without_Head = () => {
  const { t } = useTranslation();
  return (
    <>
      <th className="Numeric">{t('trading.fsRuleWithoutTrades')}</th>
      <th className="Numeric">{t('trading.fsRuleWithoutReturn')}</th>
      <th className="Numeric">{t('trading.fsRuleWithoutDrawdown')}</th>
      <th className="Numeric">{t('trading.fsRuleDelta')}</th>
    </>
  );
};

// As células: trades, retorno e max DD sem a regra, e o Δ (atual − sem ela: o que a regra rende)
export const Rule_Without_Cells = ({ row, f }: { row: Rule_Without; f: Format }) => {
  const { t } = useTranslation();
  return (
    <>
      <td className="Numeric">{f.number(row.withoutTrades)}</td>
      <td className={`Numeric ${f.tone(row.withoutReturnPct)}`}>{f.signedPercent(row.withoutReturnPct, 2)}</td>
      <td className="Numeric">{f.percent(row.withoutMaxDrawdownPct, 2)}</td>
      <td className={`Numeric Strong ${f.tone(row.deltaPp)}`}>
        {row.deltaPp == null ? '—' : t('trading.fsPpValue', { value: f.signed(row.deltaPp, 2) })}
      </td>
    </>
  );
};
