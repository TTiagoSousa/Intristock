import { useTranslation } from 'react-i18next';
import type { Context_Rules, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { entriesOf } from '../Trading_Simulator/simulationForm';
import Factsheet_Entry_Name from './Factsheet_Entry_Name';
import Factsheet_Panel from './Factsheet_Panel';
import { Rule_Without_Cells, Rule_Without_Head } from './Factsheet_Rule_Without';
import { moneyUnit, useFactsheetFormat } from './factsheetFormat';
import { useRuleTexts } from './ruleTexts';

interface Factsheet_Context_Rules_Props {
  table: Context_Rules;
  run: Simulation_Run;
}

/**
 * 2.2 — Cada condição da conta («só entra se») de cada entrada: a regra por
 * extenso, os sinais que parou (cada sinal conta na primeira que falhou) e a %
 * dos sinais da entrada, e a estratégia corrida sem ela, com o que a regra rende.
 */
const Factsheet_Context_Rules = ({ table, run }: Factsheet_Context_Rules_Props) => {
  const { t } = useTranslation();
  const entries = entriesOf(run.strategy);
  const texts = useRuleTexts(run);
  const f = useFactsheetFormat(moneyUnit(run.instrument.quote));

  return (
    <Factsheet_Panel title={t('trading.fsContextTitle')} note={t('trading.fsContextNote')} explain="setupContext">
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsByEntryEntry')}</th>
              <th>{t('trading.fsContextRule')}</th>
              <th className="Numeric">{t('trading.fsContextBlocked')}</th>
              <Rule_Without_Head />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={`${row.rule}.${row.index}`}>
                <td>
                  <Factsheet_Entry_Name entries={entries} rule={row.rule} />
                </td>
                <td className="Factsheet_Table_Wrap">{texts[row.rule - 1]?.context[row.index - 1] ?? '—'}</td>
                <td className="Numeric">{`${f.number(row.blocked)} (${f.percent(row.blockedPct, 0)})`}</td>
                <Rule_Without_Cells row={row} f={f} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="Factsheet_By_Entry_Footnote">{t('trading.fsRuleFootnote')}</p>
    </Factsheet_Panel>
  );
};

export default Factsheet_Context_Rules;
