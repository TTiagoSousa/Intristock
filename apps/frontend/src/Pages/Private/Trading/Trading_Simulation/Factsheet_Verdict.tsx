import { useTranslation } from 'react-i18next';
import * as Icon from '../../../../Imports/icons';
import type { Entry_Payload, Verdict_Finding, Verdicts } from '../../../../Hooks/Trading/useSimulation';
import Factsheet_Panel from './Factsheet_Panel';
import { useVerdictFormat } from './verdictFormat';

interface Factsheet_Verdict_Props {
  verdicts: Verdicts;
  entries: Entry_Payload[];
  unit: string;
}

// O símbolo de cada estado de um teste
const STATE_MARK = { pass: <Icon.Check />, fail: <Icon.Close />, unknown: '?' } as const;

/**
 * O veredicto da estratégia: robusta, frágil ou inconclusiva, e cada teste de
 * robustez (amostra, fora da amostra, Monte Carlo, sensibilidade,
 * walk-forward, custos, regimes, concentração) a passar, a falhar ou por
 * decidir, com os números. Tudo vem calculado pelo simulador.
 */
export const Factsheet_Verdict = ({ verdicts, entries, unit }: Factsheet_Verdict_Props) => {
  const { t } = useTranslation();
  const { values } = useVerdictFormat(entries, unit);
  return (
    <Factsheet_Panel explain="sumVerdict" title={t('trading.fsVerdictTitle')} note={t('trading.fsVerdictNote')}>
      <div className={`Factsheet_Verdict ${verdicts.overall}`}>
        <span className="Factsheet_Verdict_Badge">{t(`trading.fsVerdict_${verdicts.overall}`)}</span>
        <span className="Factsheet_Verdict_Text">
          {t(`trading.fsVerdictText_${verdicts.overall}`, { passes: verdicts.passes, fails: verdicts.fails })}
        </span>
      </div>
      <ul className="Factsheet_Tests">
        {verdicts.tests.map((test) => (
          <li key={test.key} className={`Factsheet_Test ${test.state}`}>
            <span className="Factsheet_Test_Mark" aria-label={t(`trading.fsTestState_${test.state}`)}>
              {STATE_MARK[test.state]}
            </span>
            <span className="Factsheet_Test_Title">{t(`trading.fsTestTitle_${test.key}`)}</span>
            <span className="Factsheet_Test_Text">{t(`trading.fsTest_${test.key}`, values(test.values))}</span>
          </li>
        ))}
      </ul>
    </Factsheet_Panel>
  );
};

interface Factsheet_Conclusions_Props {
  findings: Verdict_Finding[];
  entries: Entry_Payload[];
  unit: string;
}

/**
 * As conclusões de um ecrã (Entradas e saídas, Horários): cada uma numa
 * linha, com o tom (a favor, contra ou neutra). Vêm calculadas pelo simulador.
 */
export const Factsheet_Conclusions = ({ findings, entries, unit }: Factsheet_Conclusions_Props) => {
  const { t } = useTranslation();
  const { values } = useVerdictFormat(entries, unit);
  if (!findings.length) return null;
  return (
    <Factsheet_Panel explain="sumConclusions" title={t('trading.fsConclusionsTitle')} note={t('trading.fsConclusionsNote')}>
      <ul className="Factsheet_Tests">
        {findings.map((finding) => (
          <li key={finding.key} className={`Factsheet_Test ${finding.tone}`}>
            <span className="Factsheet_Test_Mark">{finding.tone === 'positive' ? '+' : finding.tone === 'negative' ? '−' : '·'}</span>
            <span className="Factsheet_Test_Text">{t(`trading.fsFinding_${finding.key}`, values(finding.values))}</span>
          </li>
        ))}
      </ul>
    </Factsheet_Panel>
  );
};
