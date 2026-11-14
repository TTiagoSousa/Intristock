import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSimulationReport } from '../../../../Hooks/Trading/useSimulation';
import type { Report_Block, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import { entriesOf } from '../Trading_Simulator/simulationForm';
import Factsheet_Card from './Factsheet_Card';
import Factsheet_Group_Bars from './Factsheet_Group_Bars';
import type { Group_Bars_Series } from './Factsheet_Group_Bars';
import Factsheet_Heading from './Factsheet_Heading';
import Factsheet_Hour_Bars from './Factsheet_Hour_Bars';
import type { Hour_Bars_Part } from './Factsheet_Hour_Bars';
import Factsheet_Markets from './Factsheet_Markets';
import Factsheet_Monte_Carlo_Fan from './Factsheet_Monte_Carlo_Fan';
import Factsheet_Prop_Challenge from './Factsheet_Prop_Challenge';
import {
  Factsheet_Cost_Stress,
  Factsheet_Regimes,
  Factsheet_Sensitivity_Table,
  Factsheet_Walk_Forward,
} from './Factsheet_Robustness_Tables';
import Factsheet_Sample_Equity from './Factsheet_Sample_Equity';
import Factsheet_Sample_Split from './Factsheet_Sample_Split';
import Factsheet_Sensitivity_Grid from './Factsheet_Sensitivity_Grid';
import { Factsheet_Verdict } from './Factsheet_Verdict';
import { moneyUnit, useFactsheetFormat } from './factsheetFormat';
import './Run_Summary.scss';

interface Run_Proofs_Props {
  run: Simulation_Run;
}

const PROOF_BLOCKS: Report_Block[] = [
  'sampleSplit',
  'sampleEquity',
  'verdicts',
  'monteCarloCards',
  'monteCarloFan',
  'monteCarloDrawdowns',
  'walkForwardCards',
  'walkForward',
  'sensitivityParams',
  'sensitivityGrid',
  'costStress',
  'regimeTable',
  'regimeGrid',
  'propChallenge',
  'propWindows',
];

// As tendências do gráfico dos regimes, pela ordem
const TRENDS = ['bull', 'lateral', 'bear'];

/**
 * O ecrã 3 de uma simulação, as Provas: se a estratégia aguenta fora do que se
 * viu. No topo o veredicto (os testes todos); a 3.1 Dentro vs fora da amostra
 * (`sampleSplit`, `sampleEquity`), a 3.2 Monte Carlo, a 3.3 Walk-forward, a
 * 3.4 Sensibilidade aos parâmetros, a 3.5 Custos, a 3.6 Regimes de mercado e
 * a 3.7 Outros mercados (a mesma estratégia corrida noutros) e, com as regras
 * dele ligadas, a 3.8 Desafio de prop firm. Tudo calculado pelo simulador.
 */
const Run_Proofs = ({ run }: Run_Proofs_Props) => {
  const { t, i18n } = useTranslation();
  const { report, loading } = useSimulationReport(run.id, PROOF_BLOCKS, run.status === 'done');
  const entries = entriesOf(run.strategy);
  const unit = moneyUnit(run.instrument.quote);
  const f = useFactsheetFormat(unit);
  const split = report?.sampleSplit;
  const equity = report?.sampleEquity;
  const verdicts = report?.verdicts;
  const mcCards = report?.monteCarloCards;
  const mcFan = report?.monteCarloFan;
  const mcDrops = report?.monteCarloDrawdowns;
  const wfCards = report?.walkForwardCards;
  const wf = report?.walkForward;
  const sensitivity = report?.sensitivityParams;
  const sensGrid = report?.sensitivityGrid;
  const costs = report?.costStress;
  const regimes = report?.regimeTable;
  const regimeGrid = report?.regimeGrid;

  const hint = (
    <span className="Factsheet_Hint">
      {t(loading ? 'common.loading' : run.status === 'done' ? 'trading.factsheetMissing' : run.status === 'cancelled' ? 'trading.factsheetCancelled' : 'trading.factsheetPending')}
    </span>
  );

  const info = split
    ? [
        t('trading.factsheetSampleInfo', { pct: formatNumber(100 - split.outOfSamplePct, i18n.language, 0) }),
        split.configured ? null : t('trading.fsSampleDefault', { pct: formatNumber(split.outOfSamplePct, i18n.language, 0) }),
      ]
        .filter(Boolean)
        .join(' ')
    : '';

  // 3.2 — o histograma da maior queda, com a barra onde ficou a real noutra cor
  const drops = useMemo(() => {
    if (!mcDrops?.bins) return null;
    const real = mcDrops.real ?? 0;
    return {
      categories: mcDrops.bins.map(([from, to]) => `${formatNumber(from, i18n.language, 0)}–${formatNumber(to, i18n.language, 0)}%`),
      values: mcDrops.bins.map(([, , count]) => count),
      labels: mcDrops.bins.map(() => ''),
      realBin: mcDrops.bins.findIndex(([from, to]) => real >= from && real < to),
    };
  }, [mcDrops, i18n.language]);
  const dropParts = useMemo<Hour_Bars_Part[]>(
    () => [
      { id: 'paths', name: t('trading.fsMcPaths'), colorToken: 'chart-buy-hold' },
      { id: 'real', name: t('trading.fsMcRealBin'), colorToken: 'chart-drawdown' },
    ],
    [t],
  );

  // 3.3 — o retorno de cada janela: a estratégia, o comprar e manter e a variante escolhida
  const wfChart = useMemo(() => {
    if (!wf?.rows) return null;
    const rows = wf.rows;
    const series: Group_Bars_Series[] = [
      { id: 'current', name: t('trading.fsWfCurrent'), colorToken: 'chart-strategy', negativeToken: 'chart-drawdown', values: rows.map((r) => r.returnPct), labels: rows.map((r) => f.signedPercent(r.returnPct, 0)) },
      { id: 'chosen', name: t('trading.fsWfChosen'), colorToken: 'exit-other', values: rows.map((r) => r.chosenReturnPct), labels: rows.map((r) => (r.chosenReturnPct == null ? '' : f.signedPercent(r.chosenReturnPct, 0))) },
      { id: 'buyHold', name: t('trading.fsWfBuyHold'), colorToken: 'chart-buy-hold', values: rows.map((r) => r.buyHoldPct), labels: rows.map((r) => f.signedPercent(r.buyHoldPct, 0)) },
    ];
    return { categories: rows.map((r) => t('trading.fsWfWindow', { window: r.window })), series };
    // f depende só da língua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wf, t, f.language]);

  // 3.6 — o retorno anualizado em cada tendência, da estratégia e do comprar e manter
  const regimeChart = useMemo(() => {
    if (!regimes) return null;
    const rows = TRENDS.map((key) => regimes.trend.find((row) => row.regime === key)).filter((row) => row != null);
    const series: Group_Bars_Series[] = [
      { id: 'strategy', name: t('trading.fsRegimeStrategy'), colorToken: 'chart-strategy', negativeToken: 'chart-drawdown', values: rows.map((r) => r.annualPct), labels: rows.map((r) => f.signedPercent(r.annualPct, 0)) },
      { id: 'buyHold', name: t('trading.fsWfBuyHold'), colorToken: 'chart-buy-hold', values: rows.map((r) => r.buyHoldAnnualPct), labels: rows.map((r) => f.signedPercent(r.buyHoldAnnualPct, 0)) },
    ];
    return { categories: rows.map((r) => t(`trading.fsRegime_${r.regime}`)), series };
    // f depende só da língua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regimes, t, f.language]);

  return (
    <div className="Run_Summary">
      {verdicts && (
        <section className="Factsheet_Section">
          <Factsheet_Verdict verdicts={verdicts} entries={entries} unit={unit} />
        </section>
      )}

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetSampleTitle')} tag={t('trading.factsheetSampleTag')} info={info} explain="proofSampleSplit" />
        {split ? (
          <>
            <Factsheet_Sample_Split table={split} unit={unit} />
            {equity && equity.points.length > 1 && <Factsheet_Sample_Equity curve={equity} unit={unit} />}
          </>
        ) : (
          hint
        )}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetMcTitle')} info={t('trading.factsheetMcInfo')} />
        {mcCards && mcFan && mcDrops && drops ? (
          mcCards.available ? (
            <>
              <div className="Factsheet_Cards">
                <Factsheet_Card
                  label={t('trading.fsMcCard_loss')}
                  help={t('trading.fsHelp_mcLoss')}
                  explain="proofMcLoss"
                  value={f.percent(mcCards.lossPct, 1)}
                  tone={(mcCards.lossPct ?? 0) > 20 ? 'Negative' : 'Positive'}
                  detail={t('trading.fsMcCard_lossDetail', { paths: f.number(mcCards.paths) })}
                />
                <Factsheet_Card
                  label={t('trading.fsMcCard_return')}
                  help={t('trading.fsHelp_mcReturn')}
                  explain="proofMcReturn"
                  value={f.signedPercent(mcCards.returnP50, 0)}
                  tone={f.tone(mcCards.returnP50)}
                  detail={t('trading.fsMcCard_returnDetail', { p5: f.signedPercent(mcCards.returnP5, 0), p95: f.signedPercent(mcCards.returnP95, 0) })}
                />
                <Factsheet_Card
                  label={t('trading.fsMcCard_real')}
                  help={t('trading.fsHelp_mcReal')}
                  explain="proofMcReal"
                  value={f.signedPercent(mcCards.realReturnPct, 0)}
                  tone={f.tone(mcCards.realReturnPct)}
                  detail={t('trading.fsMcCard_realDetail', { rank: f.number(mcCards.realReturnRank, 0) })}
                />
                <Factsheet_Card
                  label={t('trading.fsMcCard_drawdown')}
                  help={t('trading.fsHelp_mcDrawdown')}
                  explain="proofMcDrawdown"
                  value={`−${f.number(mcCards.drawdownP95, 1)}%`}
                  tone="Negative"
                  detail={t('trading.fsMcCard_drawdownDetail', { median: f.number(mcCards.drawdownP50, 1) })}
                />
                <Factsheet_Card
                  label={t('trading.fsMcCard_realDrawdown')}
                  help={t('trading.fsHelp_mcRealDrawdown')}
                  explain="proofMcRealDrawdown"
                  value={`−${f.number(mcCards.realDrawdownPct, 1)}%`}
                  detail={t('trading.fsMcCard_realDrawdownDetail', { rank: f.number(mcCards.realDrawdownRank, 0) })}
                />
                <Factsheet_Card
                  label={t('trading.fsMcCard_ruin')}
                  help={t('trading.fsHelp_mcRuin')}
                  explain="proofMcRuin"
                  value={f.percent(mcDrops.ruin?.find((item) => item.level === 50)?.pct, 1)}
                  tone="Negative"
                  detail={t('trading.fsMcCard_ruinDetail')}
                />
              </div>
              <Factsheet_Monte_Carlo_Fan fan={mcFan} />
              <Factsheet_Hour_Bars
                title={t('trading.fsMcDropsTitle')}
                explain="proofMcDrops"
                note={t('trading.fsMcDropsNote', { real: f.number(mcDrops.real, 1) })}
                parts={dropParts}
                values={drops.values}
                labels={drops.labels}
                categories={drops.categories}
                partOf={(index) => (index === drops.realBin ? 'real' : 'paths')}
                positive
                tooltip={(index) =>
                  `<strong>${drops.categories[index]}</strong><br>${t('trading.fsMcPaths')}: <strong>${f.number(drops.values[index])}</strong>`
                }
                footer={(mcDrops.ruin ?? []).map((item) => (
                  <span key={item.level}>{t('trading.fsMcRuinLine', { level: item.level, pct: f.percent(item.pct, 1) })}</span>
                ))}
              />
            </>
          ) : (
            <span className="Factsheet_Hint">{t('trading.fsMcUnavailable')}</span>
          )
        ) : (
          hint
        )}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetWfTitle')} info={t('trading.factsheetWfInfo')} />
        {wfCards && wf ? (
          wfCards.available && wfChart ? (
            <>
              <div className="Factsheet_Cards">
                <Factsheet_Card
                  label={t('trading.fsWfCard_positive')}
                  help={t('trading.fsHelp_wfPositive')}
                  explain="proofWfPositive"
                  value={t('trading.fsWfOf', { value: wfCards.positiveWindows, total: wfCards.windows })}
                  detail={t('trading.fsWfCard_positiveDetail', { beat: wfCards.beatBuyHold })}
                />
                <Factsheet_Card
                  label={t('trading.fsWfCard_chain')}
                  help={t('trading.fsHelp_wfChain')}
                  explain="proofWfChain"
                  value={f.signedPercent(wfCards.walkForwardPct, 1)}
                  tone={f.tone(wfCards.walkForwardPct)}
                  detail={t('trading.fsWfCard_chainDetail', { fixed: f.signedPercent(wfCards.fixedPct, 1) })}
                />
                <Factsheet_Card
                  label={t('trading.fsWfCard_chosen')}
                  help={t('trading.fsHelp_wfChosen')}
                  explain="proofWfChosen"
                  value={t('trading.fsWfOf', { value: wfCards.chosenPositive, total: wfCards.windows - 1 })}
                  detail={t('trading.fsWfCard_chosenDetail')}
                />
                <Factsheet_Card
                  label={t('trading.fsWfCard_beat')}
                  help={t('trading.fsHelp_wfBeat')}
                  explain="proofWfBeat"
                  value={t('trading.fsWfOf', { value: wfCards.chosenBeatFixed, total: wfCards.windows - 1 })}
                  detail={t('trading.fsWfCard_beatDetail')}
                />
                <Factsheet_Card
                  label={t('trading.fsWfCard_worst')}
                  help={t('trading.fsHelp_wfWorst')}
                  explain="proofWfWorst"
                  value={f.signedPercent(wfCards.worstWindowPct, 1)}
                  tone={f.tone(wfCards.worstWindowPct)}
                  detail={t('trading.fsWfCard_worstDetail')}
                />
              </div>
              <Factsheet_Group_Bars
                title={t('trading.fsWfChartTitle')}
                explain="proofWfChart"
                note={t('trading.fsWfChartNote')}
                categories={wfChart.categories}
                series={wfChart.series}
                tooltip={(index) =>
                  `<strong>${wfChart.categories[index]}</strong>` +
                  wfChart.series.map((part) => `<br>${part.name}: <strong>${f.signedPercent(part.values[index], 1)}</strong>`).join('')
                }
              />
              <Factsheet_Walk_Forward table={wf} sensitivity={sensitivity ?? null} entries={entries} unit={unit} />
            </>
          ) : (
            <span className="Factsheet_Hint">{t('trading.fsWfUnavailable')}</span>
          )
        ) : (
          hint
        )}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetSensTitle')} info={t('trading.factsheetSensInfo')} />
        {sensitivity && sensGrid ? (
          sensitivity.rows.length ? (
            <>
              <div className="Factsheet_Cards Four">
                <Factsheet_Card
                  label={t('trading.fsSensCard_positive')}
                  help={t('trading.fsHelp_sensPositive')}
                  explain="proofSensPositive"
                  value={f.percent(sensitivity.positivePct, 0)}
                  tone={(sensitivity.positivePct ?? 0) >= 80 ? 'Positive' : 'Negative'}
                  detail={t('trading.fsSensCard_positiveDetail', { count: sensitivity.rows.length * sensitivity.steps.length })}
                />
                <Factsheet_Card
                  label={t('trading.fsSensCard_out')}
                  help={t('trading.fsHelp_sensOut')}
                  explain="proofSensOut"
                  value={f.percent(sensitivity.outPositivePct, 0)}
                  tone={(sensitivity.outPositivePct ?? 0) >= 50 ? 'Positive' : 'Negative'}
                  detail={t('trading.fsSensCard_outDetail')}
                />
                <Factsheet_Card
                  label={t('trading.fsSensCard_rank')}
                  help={t('trading.fsHelp_sensRank')}
                  explain="proofSensRank"
                  value={f.number(sensitivity.currentRank, 0)}
                  tone={(sensitivity.currentRank ?? 0) > 90 ? 'Negative' : ''}
                  detail={t('trading.fsSensCard_rankDetail')}
                />
                <Factsheet_Card
                  label={t('trading.fsSensCard_params')}
                  help={t('trading.fsHelp_sensParams')}
                  explain="proofSensParams"
                  value={f.number(sensitivity.rows.length)}
                  detail={t('trading.fsSensCard_paramsDetail', {
                    steps: sensitivity.steps.map((step) => `×${f.number(step, 1)}`).join(' '),
                  })}
                />
              </div>
              {sensGrid.cells && <Factsheet_Sensitivity_Grid grid={sensGrid} entries={entries} unit={unit} />}
              <Factsheet_Sensitivity_Table table={sensitivity} entries={entries} unit={unit} />
            </>
          ) : (
            <span className="Factsheet_Hint">{t('trading.fsSensUnavailable')}</span>
          )
        ) : (
          hint
        )}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetCostTitle')} info={t('trading.factsheetCostInfo')} />
        {costs ? <Factsheet_Cost_Stress table={costs} unit={unit} /> : hint}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetRegimeTitle')} info={t('trading.factsheetRegimeInfo')} />
        {regimes && regimeGrid && regimeChart ? (
          <>
            <Factsheet_Group_Bars
              title={t('trading.fsRegimeChartTitle')}
              explain="proofRegimeChart"
              note={t('trading.fsRegimeChartNote')}
              categories={regimeChart.categories}
              series={regimeChart.series}
              tooltip={(index) =>
                `<strong>${regimeChart.categories[index]}</strong>` +
                regimeChart.series.map((part) => `<br>${part.name}: <strong>${f.signedPercent(part.values[index], 1)}</strong>`).join('')
              }
            />
            <Factsheet_Regimes table={regimes} grid={regimeGrid} unit={unit} />
          </>
        ) : (
          hint
        )}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetMarketsTitle')} info={t('trading.factsheetMarketsInfo')} />
        <Factsheet_Markets run={run} />
      </section>

      {report?.propChallenge && (
        <section className="Factsheet_Section">
          <Factsheet_Heading title={t('trading.factsheetPropTitle')} info={t('trading.factsheetPropInfo')} />
          <Factsheet_Prop_Challenge challenge={report.propChallenge} windows={report.propWindows} unit={unit} />
        </section>
      )}
    </div>
  );
};

export default Run_Proofs;
