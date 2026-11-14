import { useTranslation } from 'react-i18next';
import type { Entry_Payload, Sizing_Schemes } from '../../../../Hooks/Trading/useSimulation';
import { entryLabel } from '../Trading_Simulator/labels';
import { useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Sizing_Schemes_Props {
  table: Sizing_Schemes;
  entries: Entry_Payload[];
}

/**
 * 4.6 — Capital por tipo de entrada: cada esquema com o risco de cada entrada
 * (escolhido dentro da amostra) e o que deu no motor; a parte de fora é a que
 * conta. O primeiro (igual para todas) é a referência, a negrito.
 */
const Factsheet_Sizing_Schemes = ({ table, entries }: Factsheet_Sizing_Schemes_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat('');

  if (!table.available) {
    return <span className="Factsheet_Hint">{t(`trading.fsSchemesUnavailable_${table.reason ?? 'noStop'}`)}</span>;
  }

  return (
    <div className="Factsheet_Panel Plain">
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsSchemesCol_scheme')}</th>
              <th>{t('trading.fsSchemesCol_risk')}</th>
              <th className="Numeric">{t('trading.fsSchemesCol_trades')}</th>
              <th className="Numeric">{t('trading.fsSchemesCol_return')}</th>
              <th className="Numeric">{t('trading.fsSchemesCol_maxDd')}</th>
              <th className="Numeric">{t('trading.fsSchemesCol_calmar')}</th>
              <th className="Numeric">{t('trading.fsSchemesCol_outReturn')}</th>
              <th className="Numeric">{t('trading.fsSchemesCol_outPf')}</th>
              <th className="Numeric">{t('trading.fsSchemesCol_outDelta')}</th>
              {table.scaleIns && <th className="Numeric">{t('trading.fsSchemesCol_addsSkipped')}</th>}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={row.scheme}>
                <td className={index === 0 ? 'Strong' : ''}>{t(`trading.fsScheme_${row.scheme}`)}</td>
                <td className="Factsheet_Table_Wrap">
                  {row.risks
                    .map((risk, position) => `${entryLabel(entries, position + 1, t)} ${f.number(risk, 2)}%`)
                    .join(' · ')}
                </td>
                <td className="Numeric">{f.number(row.trades)}</td>
                <td className={`Numeric ${f.tone(row.returnPct)}`}>{f.signedPercent(row.returnPct)}</td>
                <td className="Numeric">{f.percent(-row.maxDrawdownPct)}</td>
                <td className="Numeric">{f.number(row.calmar, 2)}</td>
                <td className={`Numeric ${f.tone(row.outReturnPct)}`}>{f.signedPercent(row.outReturnPct)}</td>
                <td className="Numeric">{f.number(row.outProfitFactor, 2)}</td>
                <td className={`Numeric ${f.tone(row.deltaOutPp)}`}>
                  {row.deltaOutPp == null ? '—' : t('trading.fsPpValue', { value: f.signed(row.deltaOutPp, 1) })}
                </td>
                {table.scaleIns && (
                  <td className={`Numeric ${row.addsSkipped ? 'Negative' : ''}`}>{f.number(row.addsSkipped ?? 0)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.scaleIns && table.rows.some((row) => row.addsSkipped) && (
        <p className="Factsheet_By_Entry_Footnote">{t('trading.fsSchemesAddsNote')}</p>
      )}
    </div>
  );
};

export default Factsheet_Sizing_Schemes;
