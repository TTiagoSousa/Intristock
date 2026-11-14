import { useTranslation } from 'react-i18next';
import type { Rule_Trade_Group, Scale_In_Stats, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { entriesOf } from '../Trading_Simulator/simulationForm';
import Factsheet_Entry_Name from './Factsheet_Entry_Name';
import Factsheet_Panel from './Factsheet_Panel';
import { Rule_Without_Cells, Rule_Without_Head } from './Factsheet_Rule_Without';
import { moneyUnit, useFactsheetFormat } from './factsheetFormat';
import { useRuleTexts } from './ruleTexts';

interface Factsheet_Scale_Ins_Props {
  table: Scale_In_Stats;
  run: Simulation_Run;
}

/**
 * 4.9 — Cada reforço de cada entrada: a regra por extenso, quantas vezes o preço
 * (ou as condições) lá chegou antes da saída, quantos entraram (e quantos com
 * menos do que o pedido), os que não couberam no capital livre e os abaixo do
 * mínimo, os trades com ele contra os sem nenhum e a estratégia corrida sem ele.
 */
const Factsheet_Scale_Ins = ({ table, run }: Factsheet_Scale_Ins_Props) => {
  const { t } = useTranslation();
  const entries = entriesOf(run.strategy);
  const texts = useRuleTexts(run);
  const f = useFactsheetFormat(moneyUnit(run.instrument.quote));
  const group = (value: Rule_Trade_Group) =>
    value.trades ? `${f.r(value.avgR)} · ${f.percent(value.winRatePct, 0)} (${f.number(value.trades)})` : '—';
  const skipped = table.rows.some((row) => row.noCapital > 0);

  return (
    <Factsheet_Panel title={t('trading.fsScaleInsTitle')} explain="entryScaleIns" note={t('trading.fsScaleInsNote')}>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsByEntryEntry')}</th>
              <th>{t('trading.fsScaleInsRule')}</th>
              <th className="Numeric">{t('trading.fsScaleInsReached')}</th>
              <th className="Numeric">{t('trading.fsScaleInsFilled')}</th>
              <th className="Numeric">{t('trading.fsScaleInsNoCapital')}</th>
              <th className="Numeric">{t('trading.fsScaleInsMinimum')}</th>
              <th className="Numeric">{t('trading.fsScaleInsWith')}</th>
              <th className="Numeric">{t('trading.fsScaleInsWithout')}</th>
              <Rule_Without_Head />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={`${row.rule}.${row.index}`}>
                <td>
                  <Factsheet_Entry_Name entries={entries} rule={row.rule} />
                </td>
                <td className="Factsheet_Table_Wrap">{texts[row.rule - 1]?.scaleIns[row.index - 1] ?? '—'}</td>
                <td className="Numeric">{f.number(row.reached)}</td>
                <td className="Numeric">
                  {row.reduced ? t('trading.fsScaleInsReduced', { filled: f.number(row.filled), reduced: f.number(row.reduced) }) : f.number(row.filled)}
                </td>
                <td className={`Numeric ${row.noCapital ? 'Negative' : ''}`}>{f.number(row.noCapital)}</td>
                <td className="Numeric">{f.number(row.rejectedMinimum)}</td>
                <td className="Numeric">{group(row.withAdd)}</td>
                <td className="Numeric">{group(row.withoutAdds)}</td>
                <Rule_Without_Cells row={row} f={f} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="Factsheet_By_Entry_Footnote">
        {t(skipped ? 'trading.fsScaleInsFootnoteSkipped' : 'trading.fsScaleInsFootnote')}
      </p>
    </Factsheet_Panel>
  );
};

export default Factsheet_Scale_Ins;
