import { useTranslation } from 'react-i18next';
import type { Entry_Payload, Exit_Efficiency, Exit_Efficiency_Row } from '../../../../Hooks/Trading/useSimulation';
import { entryLabel, exitColumnLabel } from '../Trading_Simulator/labels';
import Factsheet_Panel from './Factsheet_Panel';
import { useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Exit_Efficiency_Props {
  table: Exit_Efficiency;
  entries: Entry_Payload[];
}

/**
 * 4.8 — Eficiência da saída, por grupo (todos, ganhos, perdidos, cada entrada e
 * cada saída): o MFE e o MAE médios, a parte do MFE que a saída leva e as velas
 * até ao melhor e ao pior ponto. Tudo vem calculado.
 */
const Factsheet_Exit_Efficiency = ({ table, entries }: Factsheet_Exit_Efficiency_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat('');

  const name = (row: Exit_Efficiency_Row) => {
    if (row.group === 'entry' && row.rule) return entryLabel(entries, row.rule, t);
    if (row.group === 'exit' && row.exit)
      return t('trading.fsEfficiencyExit', { name: exitColumnLabel(entries, row.exit, t, f.language) });
    return t(`trading.fsEfficiencyGroup_${row.group}`);
  };

  return (
    <Factsheet_Panel title={t('trading.fsEfficiencyTitle')} explain="entryEfficiency" note={t('trading.fsEfficiencyNote')}>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsEfficiencyCol_group')}</th>
              <th className="Numeric">{t('trading.fsEfficiencyCol_trades')}</th>
              <th className="Numeric">{t('trading.fsEfficiencyCol_mfe')}</th>
              <th className="Numeric">{t('trading.fsEfficiencyCol_mae')}</th>
              <th className="Numeric">{t('trading.fsEfficiencyCol_capture')}</th>
              <th className="Numeric">{t('trading.fsEfficiencyCol_barsToMfe')}</th>
              <th className="Numeric">{t('trading.fsEfficiencyCol_barsToMae')}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={index}>
                <td className="Strong">{name(row)}</td>
                <td className="Numeric">{f.number(row.trades)}</td>
                <td className="Numeric Positive">{f.percent(row.mfePct, 2)}</td>
                <td className="Numeric Negative">{f.percent(row.maePct, 2)}</td>
                <td className={`Numeric Strong ${f.tone(row.capturePct)}`}>{f.percent(row.capturePct, 0)}</td>
                <td className="Numeric">{f.number(row.barsToMfe, 1)}</td>
                <td className="Numeric">{f.number(row.barsToMae, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="Factsheet_Panel_Footnote">{t('trading.fsEfficiencyFootnote')}</p>
    </Factsheet_Panel>
  );
};

export default Factsheet_Exit_Efficiency;
