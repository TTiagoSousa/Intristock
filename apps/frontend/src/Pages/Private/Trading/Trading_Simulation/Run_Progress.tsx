import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import * as Icon from '../../../../Imports/icons';
import Cancel_Simulation_Popover from '../Trading_Simulations/Cancel_Simulation_Popover';
import { canCancelRun } from '../../../../Hooks/Trading/useSimulations';
import type { Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { useNow } from '../../../../Hooks/useNow';
import { formatDay, formatNumber } from '../Trading_Simulator/format';
import { RUN_STAGES, formatClock, formatDuration, runProgressOf } from '../Trading_Simulator/runProgress';
import type { Run_Stage } from '../Trading_Simulator/runProgress';
import Factsheet_Card from './Factsheet_Card';
import Factsheet_Heading from './Factsheet_Heading';
import './Run_Summary.scss';
import './Run_Progress.scss';

/**
 * A página de uma simulação enquanto não acaba, com as peças das outras vistas:
 * os cartões (a %, a fase, o tempo que leva, o que falta, o fim previsto e os
 * trades), a barra, as fases (velas, fila, simulação, relatório, gravação) e a
 * ficha do que já se sabe. Tudo vem do backend (o downloader e o simulador
 * gravam onde vão); aqui só se desenha, com o relógio a andar. Na fila ou a
 * correr, cancela-se (pergunta antes); a cancelar, diz que está a parar.
 */
const Run_Progress = ({ run }: { run: Simulation_Run }) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const now = useNow(true);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const { stage, percent, endAt } = runProgressOf(run, now);
  const info = run.progressInfo;
  const current = stage ? RUN_STAGES.indexOf(stage) : RUN_STAGES.length;

  const startedAt = run.startedAt ?? run.download.startedAt ?? null;
  const elapsed = startedAt ? now - new Date(startedAt).getTime() : null;
  const count = (value: number | null | undefined) => (value == null ? '—' : formatNumber(value, language, 0));
  const monthLabel = (date: string) =>
    new Date(date).toLocaleDateString(language, { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const tf = t(`trading.tf_${run.timeframe}`);
  const market = `${run.instrument.asset.ticker ?? run.instrument.symbol}/${run.instrument.quote}`;
  const section = info?.phase === 'report' ? t(`trading.progressSection_${info.section ?? 'report'}`) : null;

  // O que cada fase diz: a feita, a em curso e as que faltam
  const detail = (step: Run_Stage, index: number) => {
    const done = index < current;
    switch (step) {
      case 'candles': {
        const { monthsDone, monthsTotal, currentMonth } = run.download;
        if (done) return t('trading.progressCandlesDone', { total: monthsTotal });
        if (index > current || !run.download.startedAt) return t('trading.progressCandlesWaiting');
        return t('trading.progressCandles', {
          done: monthsDone,
          total: monthsTotal,
          current: currentMonth ? monthLabel(currentMonth) : '—',
        });
      }
      case 'queue':
        return done && run.startedAt
          ? t('trading.progressQueueDone', { time: formatClock(new Date(run.startedAt).getTime(), language) })
          : t('trading.progressQueue');
      case 'simulation':
        if (index === current && info?.phase === 'loading') return t('trading.progressLoading');
        return info?.bars ? t('trading.progressSimulation', { bars: count(info.bars), tf }) : t('trading.progressSimulationWaiting');
      case 'report':
        if (index > current) return t('trading.progressReportWaiting');
        return t('trading.progressReport', { section, done: info?.variantsDone ?? 0, total: info?.variantsTotal ?? 0 });
      case 'saving':
        return info?.trades != null ? t('trading.progressSaving', { trades: count(info.trades) }) : t('trading.progressSavingWaiting');
    }
  };

  // A ficha: o que se pediu e o que já se sabe
  const sheet = [
    { label: t('trading.progressRowMarket'), value: `${market} · ${run.instrument.source.toUpperCase()} · ${t(`trading.type_${run.instrument.type}`)}` },
    { label: t('trading.progressRowTimeframe'), value: tf },
    { label: t('trading.progressRowPeriod'), value: `${formatDay(run.fromDate, language)} – ${formatDay(run.toDate, language)}` },
    { label: t('trading.progressRowWarmup'), value: run.download.fromDate ? formatDay(run.download.fromDate, language) : '—' },
    { label: t('trading.progressRowMonths'), value: `${run.download.monthsDone} / ${run.download.monthsTotal}` },
    { label: t('trading.progressRowMinutes'), value: count(run.download.candles) },
    { label: t('trading.progressRowBars'), value: count(info?.bars) },
    { label: t('trading.progressRowVariants'), value: info?.variantsTotal ? `${info.variantsDone ?? 0} / ${info.variantsTotal}` : '—' },
  ];

  return (
    <div className="Run_Summary Run_Progress">
      <section className="Factsheet_Section">
        <Factsheet_Heading
          title={t('trading.progressHeadTitle')}
          tag={`${market} · ${tf}`}
          info={t('trading.progressHeadInfo')}
        />
        <div className="Factsheet_Cards">
          <Factsheet_Card
            label={t('trading.progressCardPercent')}
            help={t('trading.progressHelp_percent')}
            value={`${percent}%`}
            detail={stage ? t(`trading.progressStage_${stage}`) : '—'}
          />
          <Factsheet_Card
            label={t('trading.progressCardStage')}
            help={t('trading.progressHelp_stage')}
            value={stage ? t(`trading.progressStage_${stage}`) : '—'}
            detail={stage ? detail(stage, current) : '—'}
          />
          <Factsheet_Card
            label={t('trading.progressElapsed')}
            help={t('trading.progressHelp_elapsed')}
            value={elapsed != null ? formatDuration(elapsed, t) : '—'}
            detail={startedAt ? t('trading.progressStartedAt', { time: formatClock(new Date(startedAt).getTime(), language) }) : '—'}
          />
          <Factsheet_Card
            label={t('trading.progressLeft')}
            help={t('trading.progressHelp_left')}
            value={endAt ? formatDuration(endAt - now, t) : '—'}
            detail={endAt ? t('trading.progressLeftDetail') : t('trading.progressNoEstimate')}
          />
          <Factsheet_Card
            label={t('trading.progressEnd')}
            help={t('trading.progressHelp_end')}
            value={endAt ? formatClock(endAt, language) : '—'}
            detail={endAt ? formatDay(new Date(endAt).toISOString(), language) : '—'}
          />
          <Factsheet_Card
            label={t('trading.progressStatTrades')}
            help={t('trading.progressHelp_trades')}
            value={count(info?.trades)}
            detail={info?.bars ? t('trading.progressSimulation', { bars: count(info.bars), tf }) : t('trading.progressSimulationWaiting')}
          />
        </div>
        <div className="Run_Progress_Bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={`Simulation_Progress_Fill${stage === 'candles' ? ' Candles' : ''}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="Run_Progress_Actions">
          {run.status === 'cancelling' ? (
            <span className="Run_Progress_Cancelling" role="status">
              {t('trading.runsStatus_cancelling')} {t('trading.runsCancellingHint')}
            </span>
          ) : (
            canCancelRun(run) && (
              <Simple_Button
                text={t('trading.runsCancelRun')}
                small
                variant="Ghost"
                onClick={() => setConfirmCancel(true)}
              />
            )
          )}
        </div>
      </section>

      {confirmCancel && (
        <Cancel_Simulation_Popover
          id={run.id}
          label={`${market} · ${tf}`}
          running={run.status === 'running'}
          onClose={() => setConfirmCancel(false)}
          onCancelled={() => setConfirmCancel(false)}
        />
      )}

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.progressStepsTitle')} info={t('trading.progressStepsInfo')} />
        <div className="Factsheet_Grid Two">
          <div className="Factsheet_Panel">
            <div className="Factsheet_Panel_Header">
              <div className="Factsheet_Panel_Heading">
                <span className="Factsheet_Panel_Title">{t('trading.progressStepsPanel')}</span>
                <span className="Factsheet_Panel_Note">{t('trading.progressStepsNote')}</span>
              </div>
            </div>
            <ol className="Run_Progress_Steps">
              {RUN_STAGES.map((step, index) => (
                <li
                  key={step}
                  className={`Run_Progress_Step ${index < current ? 'Done' : index === current ? 'Current' : 'Pending'}`}
                >
                  <span className="Run_Progress_Step_Mark" aria-hidden="true">
                    {index < current ? <Icon.Check /> : index + 1}
                  </span>
                  <span className="Run_Progress_Step_Text">
                    <span className="Run_Progress_Step_Name">{t(`trading.progressStage_${step}`)}</span>
                    <span className="Run_Progress_Step_Detail">{detail(step, index)}</span>
                  </span>
                  {index === current && step !== 'queue' && <span className="Run_Progress_Step_Percent">{percent}%</span>}
                </li>
              ))}
            </ol>
          </div>

          <div className="Factsheet_Panel Factsheet_Sheet_Card">
            <div className="Factsheet_Panel_Header">
              <div className="Factsheet_Panel_Heading">
                <span className="Factsheet_Panel_Title">{t('trading.progressSheetPanel')}</span>
                <span className="Factsheet_Panel_Note">{t('trading.progressSheetNote')}</span>
              </div>
            </div>
            <dl className="Factsheet_Sheet_List">
              {sheet.map((row) => (
                <div key={row.label} className="Factsheet_Sheet_Row">
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Run_Progress;
