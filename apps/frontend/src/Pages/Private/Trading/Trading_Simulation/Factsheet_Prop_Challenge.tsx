import { useTranslation } from 'react-i18next';
import type { Prop_Challenge, Prop_Result, Prop_Windows } from '../../../../Hooks/Trading/useSimulation';
import { formatDay } from '../Trading_Simulator/format';
import Factsheet_Card from './Factsheet_Card';
import type { Tone } from './Factsheet_Card';
import Factsheet_Explain from './Factsheet_Explain';
import { useFactsheetFormat } from './factsheetFormat';

interface Factsheet_Prop_Challenge_Props {
  challenge: Prop_Challenge;
  windows: Prop_Windows | null | undefined;
  unit: string;
}

const OUTCOME_TONE: Record<Prop_Result['outcome'], Tone> = { passed: 'Positive', failed: 'Negative', open: '' };

/**
 * 3.8 — Desafio de prop firm: o período todo como um desafio (passou, chumbou e
 * porquê, ou ficou por decidir), a pior perda num dia e a maior queda contra os
 * limites, e os desafios de N dias a começar em cada segunda-feira — quantos
 * passam e, numa fita, o resultado de cada um. Tudo calculado pelo simulador.
 */
const Factsheet_Prop_Challenge = ({ challenge, windows, unit }: Factsheet_Prop_Challenge_Props) => {
  const { t } = useTranslation();
  const f = useFactsheetFormat(unit);
  const rules = challenge.rules;
  const whole = challenge.whole;
  const summary = challenge.windows;
  if (!challenge.available || !rules || !whole || !summary) {
    return <span className="Factsheet_Hint">{t('trading.fsPropUnavailable')}</span>;
  }

  const when = (result: Prop_Result) =>
    result.atMs == null
      ? t('trading.fsPropFinal', { pct: f.signedPercent(result.finalPct) })
      : t(result.outcome === 'passed' ? 'trading.fsPropPassedAt' : `trading.fsPropFailedAt_${result.rule}`, {
          days: f.number(result.days, 1),
          date: formatDay(result.atMs, f.language),
        });
  const limit = (pct: number | null) => (pct == null ? t('trading.fsPropNoLimit') : t('trading.fsPropLimit', { pct: f.percent(-pct) }));

  return (
    <>
      <div className="Factsheet_Cards">
        <Factsheet_Card
          label={t('trading.fsPropWhole')}
          help={t('trading.fsPropWholeHelp')}
          explain="proofPropWhole"
          value={t(`trading.fsPropOutcome_${whole.outcome}`)}
          detail={when(whole)}
          tone={OUTCOME_TONE[whole.outcome]}
        />
        <Factsheet_Card
          label={t('trading.fsPropWorstDay')}
          help={t('trading.fsPropWorstDayHelp')}
          explain="proofPropWorstDay"
          value={f.percent(whole.worstDailyPct)}
          detail={limit(rules.dailyLossPct)}
          tone={rules.dailyLossPct != null && (whole.worstDailyPct ?? 0) < -rules.dailyLossPct ? 'Negative' : ''}
        />
        <Factsheet_Card
          label={t('trading.fsPropDrawdown')}
          help={t(`trading.fsPropDrawdownHelp_${rules.maxLossMode}`)}
          explain="proofPropDrawdown"
          value={f.percent(whole.maxDrawdownPct)}
          detail={limit(rules.maxLossPct)}
          tone={rules.maxLossPct != null && (whole.maxDrawdownPct ?? 0) < -rules.maxLossPct ? 'Negative' : ''}
        />
        <Factsheet_Card
          label={t('trading.fsPropPassRate', { days: rules.days })}
          help={t('trading.fsPropPassRateHelp', { days: rules.days })}
          explain="proofPropPassRate"
          value={f.percent(summary.passRatePct, 0)}
          detail={t('trading.fsPropPassRateDetail', { passed: summary.passed, count: summary.count })}
          tone={summary.passRatePct != null && summary.passRatePct >= 50 ? 'Positive' : ''}
        />
        <Factsheet_Card
          label={t('trading.fsPropFailed')}
          help={t('trading.fsPropFailedHelp')}
          explain="proofPropFailed"
          value={f.number(summary.failed)}
          detail={t('trading.fsPropFailedDetail', { daily: summary.failedDaily, max: summary.failedMaxLoss, open: summary.open })}
          tone={summary.failed > summary.passed ? 'Negative' : ''}
        />
        <Factsheet_Card
          label={t('trading.fsPropDaysToPass')}
          help={t('trading.fsPropDaysToPassHelp')}
          explain="proofPropDaysToPass"
          value={summary.medianDaysToPass == null ? '—' : t('trading.fsPropDays', { days: f.number(summary.medianDaysToPass, 1) })}
          detail={t('trading.fsPropTradingDays', { days: whole.tradingDays, min: rules.minTradingDays })}
        />
      </div>

      {windows && windows.windows.length > 0 && (
        <div className="Factsheet_Panel">
          <div className="Factsheet_Panel_Header">
            <div className="Factsheet_Panel_Heading">
              <span className="Factsheet_Panel_Title">
                {t('trading.fsPropWindowsTitle', { days: windows.days })}
                <Factsheet_Explain id="proofPropWindows" title={t('trading.fsPropWindowsTitle', { days: windows.days })} />
              </span>
              <span className="Factsheet_Panel_Note">{t('trading.fsPropWindowsNote')}</span>
            </div>
          </div>
          <div className="Prop_Strip" role="list">
            {windows.windows.map((item) => {
              const date = formatDay(item.startMs, f.language);
              const label = `${date} · ${t(`trading.fsPropOutcome_${item.outcome}`)}${
                item.days != null ? ` · ${t('trading.fsPropDays', { days: f.number(item.days, 1) })}` : ''
              }${item.rule ? ` · ${t(`trading.fsPropRule_${item.rule}`)}` : ''}`;
              return (
                <span key={item.startMs} role="listitem" className={`Prop_Window ${item.outcome}`} title={label} aria-label={label} />
              );
            })}
          </div>
          <div className="Prop_Legend">
            {(['passed', 'failed', 'open'] as const).map((outcome) => (
              <span key={outcome} className="Prop_Legend_Item">
                <span className={`Prop_Window ${outcome}`} />
                {t(`trading.fsPropOutcome_${outcome}`)}
              </span>
            ))}
          </div>
        </div>
      )}
      {challenge.deposits && <span className="Factsheet_Hint">{t('trading.fsPropDeposits')}</span>}
    </>
  );
};

export default Factsheet_Prop_Challenge;
