import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSimulationReport } from '../../../../Hooks/Trading/useSimulation';
import type { Report_Block, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { entryLabel } from '../Trading_Simulator/labels';
import { entriesOf } from '../Trading_Simulator/simulationForm';
import Factsheet_After_Exit from './Factsheet_After_Exit';
import Factsheet_Card from './Factsheet_Card';
import Factsheet_Correlation from './Factsheet_Correlation';
import Factsheet_Durations from './Factsheet_Durations';
import Factsheet_Entry_Equity from './Factsheet_Entry_Equity';
import Factsheet_Entry_Table from './Factsheet_Entry_Table';
import Factsheet_Exit_Efficiency from './Factsheet_Exit_Efficiency';
import Factsheet_Exit_Matrix from './Factsheet_Exit_Matrix';
import Factsheet_Exit_Mix from './Factsheet_Exit_Mix';
import Factsheet_Exit_Reasons from './Factsheet_Exit_Reasons';
import Factsheet_Heading from './Factsheet_Heading';
import Factsheet_Kelly from './Factsheet_Kelly';
import Factsheet_Mae_Scatter from './Factsheet_Mae_Scatter';
import Factsheet_Next_Trade from './Factsheet_Next_Trade';
import Factsheet_Profile from './Factsheet_Profile';
import Factsheet_R_Distribution from './Factsheet_R_Distribution';
import Factsheet_Scale_Ins from './Factsheet_Scale_Ins';
import Factsheet_Sizing_Schemes from './Factsheet_Sizing_Schemes';
import Factsheet_Stop_Rules from './Factsheet_Stop_Rules';
import Factsheet_Stops_Month from './Factsheet_Stops_Month';
import Factsheet_Trade_Groups from './Factsheet_Trade_Groups';
import Factsheet_Trade_Journal from './Factsheet_Trade_Journal';
import Factsheet_Trade_Path from './Factsheet_Trade_Path';
import { moneyUnit, useFactsheetFormat } from './factsheetFormat';
import { Factsheet_Conclusions } from './Factsheet_Verdict';
import './Run_Summary.scss';

interface Run_Entries_Exits_Props {
  run: Simulation_Run;
}

const ENTRY_BLOCKS: Report_Block[] = [
  'entryCards',
  'entryPerformance',
  'entryEquity',
  'entryExitMatrix',
  'exitMix',
  'stopCards',
  'exitReasons',
  'stopsByMonth',
  'afterExit',
  'rDistribution',
  'maeScatter',
  'durationBuckets',
  'sizingSchemes',
  'entryKelly',
  'entryCorrelation',
  'tradeAnatomy',
  'tradePath',
  'exitEfficiency',
  'nextTrade',
  'tradeGroups',
  'stopRuleStats',
  'scaleInStats',
  'profileCards',
  'profilePosition',
  'profileDistance',
  'verdicts',
];

/**
 * O ecrã 4 de uma simulação, Entradas e saídas: 4.1 por entrada, 4.2 entrada →
 * saída, 4.3 stops e tipos de saída, 4.4 depois da saída, 4.5 distribuições e
 * 4.6 capital por tipo de entrada, 4.7 diário de trades (os trades gravados,
 * às páginas), 4.8 anatomia do trade e 4.9 regras da entrada (ajustes do stop e
 * reforços, só se a estratégia os tiver) e 4.10 perfil de volume (só se a estratégia o usar). Um bloco do relatório por tabela ou gráfico,
 * tudo já calculado pelo simulador.
 */
const Run_Entries_Exits = ({ run }: Run_Entries_Exits_Props) => {
  const { t } = useTranslation();
  const { report, loading } = useSimulationReport(run.id, ENTRY_BLOCKS, run.status === 'done');
  const entries = entriesOf(run.strategy);
  const unit = moneyUnit(run.instrument.quote);
  const f = useFactsheetFormat(unit);

  const hint = (
    <span className="Factsheet_Hint">
      {t(loading ? 'common.loading' : run.status === 'done' ? 'trading.factsheetMissing' : run.status === 'cancelled' ? 'trading.factsheetCancelled' : 'trading.factsheetPending')}
    </span>
  );
  // Um bloco ou, sem ele, o aviso (a carregar, simulação antiga ou ainda a correr)
  const block = <T,>(value: T | null | undefined, render: (value: T) => ReactNode) => (value ? render(value) : hint);

  const cards = report?.entryCards;
  const performance = report?.entryPerformance;
  const equity = report?.entryEquity;
  const matrix = report?.entryExitMatrix;
  const mix = report?.exitMix;
  const stops = report?.stopCards;
  const reasons = report?.exitReasons;
  const months = report?.stopsByMonth;
  const after = report?.afterExit;
  const distribution = report?.rDistribution;
  const mae = report?.maeScatter;
  const durations = report?.durationBuckets;
  const schemes = report?.sizingSchemes;
  const kelly = report?.entryKelly;
  const correlation = report?.entryCorrelation;
  const anatomy = report?.tradeAnatomy;
  const tradePath = report?.tradePath;
  const efficiency = report?.exitEfficiency;
  const nextTrade = report?.nextTrade;
  const groups = report?.tradeGroups;
  const stopRules = report?.stopRuleStats;
  const scaleIns = report?.scaleInStats;
  const name = (rule: number) => entryLabel(entries, rule, t);

  return (
    <div className="Run_Summary">
      {report?.verdicts && (
        <section className="Factsheet_Section">
          <Factsheet_Conclusions findings={report.verdicts.screens.entries} entries={entries} unit={unit} />
        </section>
      )}
      <section className="Factsheet_Section">
        <Factsheet_Heading
          title={t('trading.factsheetEntriesTitle')}
          info={t('trading.factsheetEntriesInfo')}
          explain="entryPerformance"
        />
        {block(cards, (data) => (
          <div className="Factsheet_Cards">
            <Factsheet_Card
              label={t('trading.fsEntCard_best')}
              help={t('trading.fsHelp_entBest')}
              explain="entryBest"
              value={data.best ? name(data.best.rule) : '—'}
              detail={data.best ? `${f.money(data.best.pnl)} · ${f.r(data.best.avgR)}` : ''}
              tone={data.best ? f.tone(data.best.pnl) : ''}
            />
            <Factsheet_Card
              label={t('trading.fsEntCard_worst')}
              help={t('trading.fsHelp_entWorst')}
              explain="entryWorst"
              value={data.worst ? name(data.worst.rule) : '—'}
              detail={data.worst ? `${f.money(data.worst.pnl)} · ${f.r(data.worst.avgR)}` : t('trading.fsEntCard_worstNone')}
              tone={data.worst ? f.tone(data.worst.pnl) : ''}
            />
            <Factsheet_Card
              label={t('trading.fsEntCard_losing')}
              help={t('trading.fsHelp_entLosing')}
              explain="entryLosing"
              value={t('trading.fsEntCard_losingValue', { losing: f.number(data.losing), entries: f.number(data.entries) })}
              detail={t('trading.fsEntCard_losingDetail')}
            />
            <Factsheet_Card
              label={t('trading.fsEntCard_flips')}
              help={t('trading.fsHelp_entFlips')}
              explain="entryFlips"
              value={f.number(data.flips)}
              detail={t('trading.fsEntCard_flipsDetail')}
            />
            <Factsheet_Card
              label={t('trading.fsEntCard_sides')}
              help={t('trading.fsHelp_entSides')}
              explain="entrySides"
              value={`${f.number(data.longs)} / ${f.number(data.shorts)}`}
              detail={t('trading.fsEntCard_sidesDetail')}
            />
            <Factsheet_Card
              label={t('trading.fsEntCard_withoutWorst')}
              help={t('trading.fsHelp_entWithoutWorst')}
              explain="entryWithoutWorst"
              value={data.withoutWorst ? f.signedPercent(data.withoutWorst.returnPct) : '—'}
              detail={
                data.withoutWorst
                  ? t('trading.fsEntCard_withoutWorstDetail', { value: f.signedPercent(data.withoutWorst.currentReturnPct) })
                  : t('trading.fsEntCard_withoutWorstNone')
              }
              tone={
                data.withoutWorst ? f.tone(data.withoutWorst.returnPct - data.withoutWorst.currentReturnPct) : ''
              }
            />
          </div>
        ))}
        {performance && <Factsheet_Entry_Table table={performance} entries={entries} unit={unit} />}
        {equity && <Factsheet_Entry_Equity curve={equity} entries={entries} unit={unit} quote={run.instrument.quote} />}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetExitMatrixTitle')} info={t('trading.factsheetExitMatrixInfo')} />
        {block(matrix, (data) => (
          <Factsheet_Exit_Matrix table={data} entries={entries} unit={unit} />
        ))}
        {matrix && mix && <Factsheet_Exit_Mix mix={mix} columns={matrix.columns} entries={entries} />}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetStopsTitle')} info={t('trading.factsheetStopsInfo')} />
        {block(stops, (data) => (
          <div className="Factsheet_Cards Four">
            <Factsheet_Card
              label={t('trading.fsStopCard_stops')}
              help={t('trading.fsHelp_stopStops')}
              explain="entryStops"
              value={f.number(data.stops)}
              detail={t('trading.fsStopCard_ofTrades', { value: f.percent(data.stopsPct, 0) })}
            />
            <Factsheet_Card
              label={t('trading.fsStopCard_ofLosses')}
              help={t('trading.fsHelp_stopOfLosses')}
              explain="entryStopsOfLosses"
              value={f.percent(data.stopsOfLossesPct, 0)}
              detail={t('trading.fsStopCard_ofLossesDetail')}
            />
            <Factsheet_Card
              label={t('trading.fsStopCard_reversed')}
              help={t('trading.fsHelp_stopReversed')}
              explain="entryStopsReversed"
              value={f.percent(data.reversedPct, 0)}
              detail={t('trading.fsStopCard_reversedDetail', { count: data.reversed, hours: data.reversalHours })}
            />
            <Factsheet_Card
              label={t('trading.fsStopCard_extra')}
              help={t('trading.fsHelp_stopExtra')}
              explain="entryStopExtra"
              value={f.percent(data.extraCostPct, 3)}
              detail={t('trading.fsStopCard_extraDetail')}
            />
            <Factsheet_Card
              label={t('trading.fsStopCard_time')}
              help={t('trading.fsHelp_stopTime')}
              explain="entryStopTime"
              value={data.barsToStop == null ? '—' : t('trading.fsBarsValue', { value: f.number(data.barsToStop, 1) })}
              detail={t('trading.fsStopCard_timeDetail')}
            />
            <Factsheet_Card
              label={t('trading.fsStopCard_streak')}
              help={t('trading.fsHelp_stopStreak')}
              explain="entryStopStreak"
              value={f.number(data.maxStreak)}
              detail={t('trading.fsStopCard_streakDetail')}
            />
            <Factsheet_Card
              label={t('trading.fsStopCard_breakEvens')}
              help={t('trading.fsHelp_stopBreakEvens')}
              explain="entryBreakEvens"
              value={f.number(data.breakEvens)}
              detail={t('trading.fsStopCard_breakEvensDetail')}
            />
            <Factsheet_Card
              label={t('trading.fsStopCard_takes')}
              help={t('trading.fsHelp_stopTakes')}
              explain="entryTakes"
              value={f.number(data.takes)}
              detail={t('trading.fsStopCard_ofTrades', { value: f.percent(data.takesPct, 0) })}
            />
          </div>
        ))}
        {reasons && <Factsheet_Exit_Reasons table={reasons} entries={entries} unit={unit} />}
        {months && <Factsheet_Stops_Month chart={months} />}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetAfterTitle')} info={t('trading.factsheetAfterInfo')} />
        {block(after, (data) => (
          <Factsheet_After_Exit data={data} />
        ))}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading
          title={t('trading.factsheetDistributionsTitle')}
          info={t('trading.factsheetDistributionsInfo')}
        />
        {block(distribution, (data) => (
          <Factsheet_R_Distribution distribution={data} />
        ))}
        {mae && <Factsheet_Mae_Scatter scatter={mae} />}
        {durations && durations.rows.length > 0 && <Factsheet_Durations table={durations} unit={unit} />}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading
          title={t('trading.factsheetCapitalTitle')}
          tag={t('trading.factsheetCapitalTag')}
          info={t('trading.factsheetCapitalInfo')}
          explain="entrySchemes"
        />
        {block(schemes, (data) => (
          <Factsheet_Sizing_Schemes table={data} entries={entries} />
        ))}
        {kelly && <Factsheet_Kelly table={kelly} entries={entries} />}
        {correlation && <Factsheet_Correlation table={correlation} entries={entries} />}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading
          title={t('trading.factsheetJournalTitle')}
          tag={t('trading.factsheetJournalTag')}
          info={t('trading.factsheetJournalInfo')}
        />
        {run.status === 'done' ? <Factsheet_Trade_Journal run={run} /> : hint}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetAnatomyTitle')} info={t('trading.factsheetAnatomyInfo')} />
        {block(anatomy, (data) => (
          <div className="Factsheet_Cards">
            <Factsheet_Card
              label={t('trading.fsAnaCard_capture')}
              help={t('trading.fsHelp_anaCapture')}
              explain="entryCapture"
              value={f.percent(data.mfeCapturePct, 0)}
              detail={t('trading.fsAnaCard_captureDetail')}
              tone={f.tone(data.mfeCapturePct)}
            />
            <Factsheet_Card
              label={t('trading.fsAnaCard_peak')}
              help={t('trading.fsHelp_anaPeak')}
              explain="entryPeak"
              value={f.number(data.barsToPeak, 1)}
              detail={t('trading.fsAnaCard_peakDetail', { value: f.number(data.avgBars, 1) })}
            />
            <Factsheet_Card
              label={t('trading.fsAnaCard_afterLoss')}
              help={t('trading.fsHelp_anaAfterLoss')}
              explain="entryAfterLoss"
              value={f.r(data.afterLoss.avgR)}
              detail={t('trading.fsAnaCard_afterDetail', {
                winRate: f.percent(data.afterLoss.winRatePct, 0),
                count: data.afterLoss.trades,
              })}
              tone={f.tone(data.afterLoss.avgR)}
            />
            <Factsheet_Card
              label={t('trading.fsAnaCard_afterWin')}
              help={t('trading.fsHelp_anaAfterWin')}
              explain="entryAfterWin"
              value={f.r(data.afterWin.avgR)}
              detail={t('trading.fsAnaCard_afterDetail', {
                winRate: f.percent(data.afterWin.winRatePct, 0),
                count: data.afterWin.trades,
              })}
              tone={f.tone(data.afterWin.avgR)}
            />
            <Factsheet_Card
              label={t('trading.fsAnaCard_separation')}
              help={t('trading.fsHelp_anaSeparation')}
              explain="entrySeparation"
              value={data.separationBar == null ? '—' : t('trading.fsAnaCard_separationValue', { value: data.separationBar })}
              detail={t(data.separationBar == null ? 'trading.fsAnaCard_separationNone' : 'trading.fsAnaCard_separationDetail', {
                value: f.number(data.separationR, 1),
              })}
            />
            <Factsheet_Card
              label={t('trading.fsAnaCard_second')}
              help={t('trading.fsHelp_anaSecond')}
              explain="entrySecond"
              value={data.secondPosition ? f.r(data.secondPosition.avgR) : '—'}
              detail={
                data.secondPosition
                  ? t('trading.fsAnaCard_secondDetail', {
                      count: data.secondPosition.trades,
                      pnl: f.money(data.secondPosition.pnl),
                    })
                  : t('trading.fsAnaCard_secondNone')
              }
              tone={data.secondPosition ? f.tone(data.secondPosition.avgR) : ''}
            />
          </div>
        ))}
        {tradePath && <Factsheet_Trade_Path path={tradePath} />}
        {efficiency && <Factsheet_Exit_Efficiency table={efficiency} entries={entries} />}
        {nextTrade && <Factsheet_Next_Trade table={nextTrade} unit={unit} />}
        {groups && <Factsheet_Trade_Groups table={groups} unit={unit} />}
      </section>
      {(stopRules?.available || scaleIns?.available) && (
        <section className="Factsheet_Section">
          <Factsheet_Heading title={t('trading.factsheetRulesTitle')} info={t('trading.factsheetRulesInfo')} />
          {stopRules?.available && <Factsheet_Stop_Rules table={stopRules} run={run} />}
          {scaleIns?.available && <Factsheet_Scale_Ins table={scaleIns} run={run} />}
        </section>
      )}
      {report?.profileCards?.available && (
        <Factsheet_Profile cards={report.profileCards} position={report.profilePosition} distance={report.profileDistance} run={run} />
      )}
    </div>
  );
};

export default Run_Entries_Exits;
