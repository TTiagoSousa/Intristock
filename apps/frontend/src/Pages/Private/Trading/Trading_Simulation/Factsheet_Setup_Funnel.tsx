import { useTranslation } from 'react-i18next';
import type { Setup_Funnel, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { entriesOf } from '../Trading_Simulator/simulationForm';
import Factsheet_Entry_Name from './Factsheet_Entry_Name';
import Factsheet_Panel from './Factsheet_Panel';
import { moneyUnit, useFactsheetFormat } from './factsheetFormat';
import { useRuleTexts } from './ruleTexts';

interface Factsheet_Setup_Funnel_Props {
  table: Setup_Funnel;
  run: Simulation_Run;
}

/**
 * 2.2 — A preparação de cada entrada que a tem: a regra por extenso, quantas
 * vezes armou, se cumpriu outra vez armada (a contagem recomeça), acabou sem
 * sinal, foi cancelada e deu sinal (e a % das vezes que armou), as velas médias
 * até ao sinal e os sinais e trades que vieram dela. Tudo contado no motor.
 */
const Factsheet_Setup_Funnel = ({ table, run }: Factsheet_Setup_Funnel_Props) => {
  const { t } = useTranslation();
  const entries = entriesOf(run.strategy);
  const texts = useRuleTexts(run);
  const f = useFactsheetFormat(moneyUnit(run.instrument.quote));

  return (
    <Factsheet_Panel title={t('trading.fsSetupTitle')} note={t('trading.fsSetupNote')} explain="setupArming">
      <div className="Factsheet_Table_Scroll">
        <table className="Factsheet_Table">
          <thead>
            <tr>
              <th>{t('trading.fsByEntryEntry')}</th>
              <th>{t('trading.fsSetupRule')}</th>
              <th className="Numeric">{t('trading.fsSetupArms')}</th>
              <th className="Numeric">{t('trading.fsSetupRearms')}</th>
              <th className="Numeric">{t('trading.fsSetupExpired')}</th>
              <th className="Numeric">{t('trading.fsSetupCancelled')}</th>
              <th className="Numeric">{t('trading.fsSetupFired')}</th>
              <th className="Numeric">{t('trading.fsSetupWait')}</th>
              <th className="Numeric">{t('trading.fsByEntrySignals')}</th>
              <th className="Numeric">{t('trading.fsByEntryTrades')}</th>
            </tr>
          </thead>
          <tbody>
            {table.entries.map((row) => (
              <tr key={row.rule}>
                <td>
                  <Factsheet_Entry_Name entries={entries} rule={row.rule} />
                </td>
                <td className="Factsheet_Table_Wrap">{texts[row.rule - 1]?.setup.join(' · ') || '—'}</td>
                <td className="Numeric">{f.number(row.arms)}</td>
                <td className="Numeric">{f.number(row.rearms)}</td>
                <td className="Numeric">{f.number(row.expired)}</td>
                <td className="Numeric">{f.number(row.cancelled)}</td>
                <td className="Numeric">{`${f.number(row.fired)} (${f.percent(row.firedPct, 0)})`}</td>
                <td className="Numeric">{row.avgBarsToSignal == null ? '—' : t('trading.fsBarsShort', { value: f.number(row.avgBarsToSignal, 1) })}</td>
                <td className="Numeric">{f.number(row.signals)}</td>
                <td className="Numeric">{f.number(row.trades)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="Factsheet_By_Entry_Footnote">{t('trading.fsSetupFootnote')}</p>
    </Factsheet_Panel>
  );
};

export default Factsheet_Setup_Funnel;
