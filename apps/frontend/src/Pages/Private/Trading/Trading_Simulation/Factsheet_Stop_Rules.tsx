import { useTranslation } from 'react-i18next';
import type { Rule_Trade_Group, Simulation_Run, Stop_Rule_Stats } from '../../../../Hooks/Trading/useSimulation';
import { entriesOf } from '../Trading_Simulator/simulationForm';
import Factsheet_Entry_Name from './Factsheet_Entry_Name';
import Factsheet_Panel from './Factsheet_Panel';
import { Rule_Without_Cells, Rule_Without_Head } from './Factsheet_Rule_Without';
import { moneyUnit, useFactsheetFormat } from './factsheetFormat';
import { useRuleTexts } from './ruleTexts';

interface Factsheet_Stop_Rules_Props {
  table: Stop_Rule_Stats;
  run: Simulation_Run;
}

/**
 * 4.9 — Cada ajuste do stop de cada entrada: a regra por extenso, em quantos
 * trades aconteceu antes da saída, os que saíram no stop que ele pôs (win rate,
 * R médio e P&L), o R médio dos trades em que aconteceu contra os outros da
 * entrada e a estratégia corrida sem ele.
 */
const Factsheet_Stop_Rules = ({ table, run }: Factsheet_Stop_Rules_Props) => {
  const { t } = useTranslation();
  const entries = entriesOf(run.strategy);
  const texts = useRuleTexts(run);
  const f = useFactsheetFormat(moneyUnit(run.instrument.quote));
  const group = (value: Rule_Trade_Group) =>
    value.trades ? `${f.r(value.avgR)} · ${f.percent(value.winRatePct, 0)} (${f.number(value.trades)})` : '—';

  return (
    <Factsheet_Panel title={t('trading.fsStopRulesTitle')} explain="entryStopRules" note={t('trading.fsStopRulesNote')}>
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsByEntryEntry')}</th>
              <th>{t('trading.fsStopRulesRule')}</th>
              <th className="Numeric">{t('trading.fsStopRulesFired')}</th>
              <th className="Numeric">{t('trading.fsStopRulesExits')}</th>
              <th className="Numeric">{t('trading.fsStopRulesExitPnl')}</th>
              <th className="Numeric">{t('trading.fsStopRulesWhenFired')}</th>
              <th className="Numeric">{t('trading.fsStopRulesNotFired')}</th>
              <Rule_Without_Head />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={`${row.rule}.${row.index}`}>
                <td>
                  <Factsheet_Entry_Name entries={entries} rule={row.rule} />
                </td>
                <td className="Factsheet_Table_Wrap">{texts[row.rule - 1]?.stopRules[row.index - 1] ?? '—'}</td>
                <td className="Numeric">{`${f.number(row.fired)} (${f.percent(row.firedPct, 0)})`}</td>
                <td className="Numeric">{group(row.exits)}</td>
                <td className={`Numeric ${f.tone(row.exits.pnl)}`}>{row.exits.trades ? f.money(row.exits.pnl) : '—'}</td>
                <td className="Numeric">{group(row.whenFired)}</td>
                <td className="Numeric">{group(row.notFired)}</td>
                <Rule_Without_Cells row={row} f={f} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="Factsheet_By_Entry_Footnote">{t('trading.fsStopRulesFootnote')}</p>
    </Factsheet_Panel>
  );
};

export default Factsheet_Stop_Rules;
