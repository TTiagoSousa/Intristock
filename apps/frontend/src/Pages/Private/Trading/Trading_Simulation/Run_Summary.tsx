import { useTranslation } from 'react-i18next';
import { useSimulationReport } from '../../../../Hooks/Trading/useSimulation';
import type { Report_Block, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber } from '../Trading_Simulator/format';
import Factsheet_Capture from './Factsheet_Capture';
import Card from './Factsheet_Card';
import type { Tone } from './Factsheet_Card';
import Factsheet_Distribution from './Factsheet_Distribution';
import Factsheet_Drawdowns from './Factsheet_Drawdowns';
import Factsheet_Equity from './Factsheet_Equity';
import Factsheet_Equity_Base from './Factsheet_Equity_Base';
import Factsheet_Heading from './Factsheet_Heading';
import Factsheet_Horizons from './Factsheet_Horizons';
import Factsheet_Ratios from './Factsheet_Ratios';
import Factsheet_Returns from './Factsheet_Returns';
import Factsheet_Rolling_Sharpe from './Factsheet_Rolling_Sharpe';
import Factsheet_Underwater from './Factsheet_Underwater';
import Factsheet_Scatter from './Factsheet_Scatter';
import Factsheet_Score from './Factsheet_Score';
import { Factsheet_Verdict } from './Factsheet_Verdict';
import { entriesOf } from '../Trading_Simulator/simulationForm';
import './Run_Summary.scss';

interface Run_Summary_Props {
  run: Simulation_Run;
}

// As stablecoins em dólares mostram-se com o $, como no resto da app
const DOLLAR_QUOTES = ['USDT', 'USDC', 'USD'];

// Os blocos do relatório que o Resumo mostra
const SUMMARY_BLOCKS: Report_Block[] = ['summaryMetrics', 'strategyScore', 'equityCurve', 'equityInBase', 'underwater', 'periodReturns', 'horizonReturns', 'dailyDistribution', 'rollingSharpe', 'monthlyDetail', 'riskMetrics', 'drawdownEpisodes', 'riskRatios', 'captureRatios', 'returnsScatter', 'verdicts'];

// A favor fica na cor da marca, contra a vermelho
const toneOf = (value: number | null): Tone => (value == null || value === 0 ? '' : value > 0 ? 'Positive' : 'Negative');

/**
 * O Resumo de uma simulação, a partir dos blocos do relatório que o simulador
 * grava no fim, já calculados. Por agora a 1.1 — Resumo e nota da estratégia:
 * os 12 números principais e a nota da estratégia; e a 1.2 — Equity e drawdown, o capital medido no ativo e o underwater; a 1.3 — Retornos; a 1.4 — Riscos; a 1.5 — Rácios ajustados ao risco; e a 1.6 — Vs benchmarks.
 */
const Run_Summary = ({ run }: Run_Summary_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { report, loading } = useSimulationReport(run.id, SUMMARY_BLOCKS, run.status === 'done');
  const summary = report?.summaryMetrics;
  const score = report?.strategyScore;
  const equity = report?.equityCurve;
  const equityBase = report?.equityInBase;
  const underwater = report?.underwater;
  const returns = report?.periodReturns;
  const horizons = report?.horizonReturns;
  const distribution = report?.dailyDistribution;
  const rollingSharpe = report?.rollingSharpe;
  const risk = report?.riskMetrics;
  const episodes = report?.drawdownEpisodes;
  const ratios = report?.riskRatios;
  const capture = report?.captureRatios;
  const scatter = report?.returnsScatter;
  const asset = run.instrument.asset.ticker ?? run.instrument.symbol.replace(run.instrument.quote, '');

  const unit = DOLLAR_QUOTES.includes(run.instrument.quote) ? '$' : run.instrument.quote;
  const sign = (value: number) => (value > 0 ? '+' : value < 0 ? '−' : '');
  const money = (value: number, digits = 0) => `${formatNumber(value, language, digits)} ${unit}`;
  const signedMoney = (value: number | null, digits = 0) =>
    value == null ? '—' : `${sign(value)}${money(Math.abs(value), digits)}`;
  const pct = (value: number | null, digits = 1) => (value == null ? '—' : `${formatNumber(value, language, digits)}%`);
  const signedPct = (value: number | null, digits = 1) =>
    value == null ? '—' : `${sign(value)}${formatNumber(Math.abs(value), language, digits)}%`;
  const number = (value: number | null, digits: number) => (value == null ? '—' : formatNumber(value, language, digits));
  const signedNumber = (value: number | null, digits: number) =>
    value == null ? '—' : `${value < 0 ? '−' : ''}${formatNumber(Math.abs(value), language, digits)}`;

  const hint = (
    <span className="Factsheet_Hint">
      {t(loading ? 'common.loading' : run.status === 'done' ? 'trading.factsheetMissing' : run.status === 'cancelled' ? 'trading.factsheetCancelled' : 'trading.factsheetPending')}
    </span>
  );

  return (
    <div className="Run_Summary">
      {/* O veredicto primeiro: robusta, frágil ou inconclusiva, com os testes das Provas */}
      {report?.verdicts && (
        <section className="Factsheet_Section">
          <Factsheet_Verdict verdicts={report.verdicts} entries={entriesOf(run.strategy)} unit={unit} />
        </section>
      )}
      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetSummaryTitle')} info={t('trading.factsheetSummaryInfo')} />
        {!summary ? (
          hint
        ) : (
          <>
            <div className="Factsheet_Cards">
              <Card
                label={t('trading.fsFinalCapital')}
                help={t('trading.fsHelp_finalCapital')}
                explain="sumFinalCapital"
                value={money(summary.finalCapital)}
                detail={
                  summary.deposits > 0
                    ? t('trading.fsInitialWithDeposits', {
                        initial: money(summary.initialCapital),
                        deposits: money(summary.deposits),
                      })
                    : t('trading.fsInitial', { value: money(summary.initialCapital) })
                }
              />
              <Card
                label={t('trading.fsNetReturn')}
                help={t('trading.fsHelp_netReturn')}
                explain="sumNetReturn"
                value={signedPct(summary.netProfitPct)}
                detail={`${signedMoney(summary.netProfit)} · CAGR ${signedPct(summary.cagrPct)}`}
                tone={toneOf(summary.netProfitPct)}
              />
              <Card
                label={t('trading.fsBuyHold', { asset })}
                help={t('trading.fsHelp_buyHold')}
                explain="sumBuyHold"
                value={signedPct(summary.buyHoldPct)}
                detail={t(summary.deposits > 0 ? 'trading.fsBuyHoldWithDeposits' : 'trading.fsSamePeriod')}
              />
              <Card
                label={t('trading.fsSharpe')}
                help={t('trading.fsHelp_sharpe')}
                explain="sumSharpe"
                value={number(summary.sharpe, 2)}
                detail={t('trading.fsSortino', { value: number(summary.sortino, 2) })}
                tone={toneOf(summary.sharpe)}
              />
              <Card
                label={t('trading.fsMaxDrawdown')}
                help={t('trading.fsHelp_maxDrawdown')}
                explain="sumMaxDrawdown"
                value={signedPct(-summary.maxDrawdownPct)}
                detail={t('trading.fsCalmar', { value: number(summary.calmar, 2) })}
                tone={summary.maxDrawdownPct > 0 ? 'Negative' : ''}
              />
              <Card
                label={t('trading.fsVolatility')}
                help={t('trading.fsHelp_volatility')}
                explain="sumVolatility"
                value={pct(summary.volatilityPct)}
                detail={t('trading.fsAnnualized')}
              />
              <Card
                label={t('trading.fsTrades')}
                help={t('trading.fsHelp_trades')}
                explain="sumTrades"
                value={number(summary.trades, 0)}
                detail={t('trading.fsPerMonth', { value: number(summary.tradesPerMonth, 1) })}
              />
              <Card
                label={t('trading.fsWinRate')}
                help={t('trading.fsHelp_winRate')}
                explain="sumWinRate"
                value={pct(summary.winRatePct)}
                detail={t('trading.fsPayoff', { value: number(summary.payoff, 2) })}
              />
              <Card
                label={t('trading.fsProfitFactor')}
                help={t('trading.fsHelp_profitFactor')}
                explain="sumProfitFactor"
                value={number(summary.profitFactor, 2)}
                detail={t('trading.fsExpectancy', { value: signedMoney(summary.expectancy, 2) })}
                tone={summary.profitFactor == null ? '' : toneOf(summary.profitFactor - 1)}
              />
              <Card
                label={t('trading.fsCosts')}
                help={t('trading.fsHelp_costs')}
                explain="sumCosts"
                value={money(summary.costs)}
                detail={t('trading.fsCostsDetail')}
              />
              <Card
                label={t('trading.fsTimeInMarket')}
                help={t('trading.fsHelp_timeInMarket')}
                explain="sumTimeInMarket"
                value={pct(summary.timeInMarketPct, 0)}
                detail={t('trading.fsMaxPositions', { value: number(summary.maxOpenPositions, 0) })}
              />
              <Card
                label={t('trading.fsPositiveDays')}
                help={t('trading.fsHelp_positiveDays')}
                explain="sumPositiveDays"
                value={pct(summary.positiveDaysPct, 0)}
                detail={t('trading.fsOfDays', { value: number(summary.days, 0) })}
              />
            </div>
            {score && <Factsheet_Score score={score} />}
          </>
        )}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading
          title={t('trading.factsheetEquityTitle')}
          info={t('trading.factsheetEquityInfo', { asset })}
        />
        {equity ? <Factsheet_Equity curve={equity} quoteLabel={unit} quoteCode={run.instrument.quote} /> : hint}
        {equityBase && <Factsheet_Equity_Base curve={equityBase} asset={asset} quoteCode={run.instrument.quote} />}
        {underwater && <Factsheet_Underwater curve={underwater} />}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetReturnsTitle')} info={t('trading.factsheetReturnsInfo')} />
        {returns ? <Factsheet_Returns table={returns} detail={report?.monthlyDetail} quoteLabel={unit} /> : hint}
        {horizons && <Factsheet_Horizons table={horizons} />}
        {distribution && <Factsheet_Distribution distribution={distribution} />}
        {rollingSharpe && <Factsheet_Rolling_Sharpe curve={rollingSharpe} />}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetRiskTitle')} info={t('trading.factsheetRiskInfo')} />
        {!risk ? (
          hint
        ) : (
          <div className="Factsheet_Cards Five">
            <Card
              label={t('trading.fsVar95')}
              help={t('trading.fsHelp_var95')}
              explain="sumVar95"
              value={signedPct(risk.var95Pct, 2)}
              detail={t('trading.fsVar95Detail')}
              tone={toneOf(risk.var95Pct)}
            />
            <Card
              label={t('trading.fsCvar95')}
              help={t('trading.fsHelp_cvar95')}
              explain="sumCvar95"
              value={signedPct(risk.cvar95Pct, 2)}
              detail={t('trading.fsCvar95Detail')}
              tone={toneOf(risk.cvar95Pct)}
            />
            <Card
              label={t('trading.fsVar99')}
              help={t('trading.fsHelp_var99')}
              explain="sumVar99"
              value={signedPct(risk.var99Pct, 2)}
              detail={t('trading.fsVar99Detail')}
              tone={toneOf(risk.var99Pct)}
            />
            <Card
              label={t('trading.fsSkewness')}
              help={t('trading.fsHelp_skewness')}
              explain="sumSkewness"
              value={signedNumber(risk.skewness, 2)}
              detail={t('trading.fsSkewnessDetail')}
              tone={toneOf(risk.skewness)}
            />
            <Card
              label={t('trading.fsKurtosis')}
              help={t('trading.fsHelp_kurtosis')}
              explain="sumKurtosis"
              value={signedNumber(risk.kurtosis, 2)}
              detail={t('trading.fsKurtosisDetail')}
            />
            <Card
              label={t('trading.fsUlcer')}
              help={t('trading.fsHelp_ulcer')}
              explain="sumUlcer"
              value={pct(risk.ulcerIndexPct, 2)}
              detail={t('trading.fsUlcerDetail')}
            />
            <Card
              label={t('trading.fsPain')}
              help={t('trading.fsHelp_pain')}
              explain="sumPain"
              value={pct(risk.painIndexPct, 2)}
              detail={t('trading.fsPainDetail')}
            />
            <Card
              label={t('trading.fsTailRatio')}
              help={t('trading.fsHelp_tailRatio')}
              explain="sumTailRatio"
              value={number(risk.tailRatio, 2)}
              detail={t('trading.fsTailRatioDetail')}
              tone={risk.tailRatio == null ? '' : toneOf(risk.tailRatio - 1)}
            />
            <Card
              label={t('trading.fsWorstDay')}
              help={t('trading.fsHelp_worstDay')}
              explain="sumWorstDay"
              value={signedPct(risk.worstDayPct)}
              detail={t('trading.fsBestDay', { value: signedPct(risk.bestDayPct) })}
              tone={toneOf(risk.worstDayPct)}
            />
            <Card
              label={t('trading.fsDrawdowns')}
              help={t('trading.fsHelp_drawdowns')}
              explain="sumDrawdownCount"
              value={number(risk.drawdowns, 0)}
              detail={t('trading.fsDrawdownsDetail')}
            />
          </div>
        )}
        {episodes && <Factsheet_Drawdowns table={episodes} />}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetRatiosTitle')} info={t('trading.factsheetRatiosInfo')} explain="sumRatios" />
        {ratios ? <Factsheet_Ratios table={ratios} /> : hint}
      </section>

      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetBenchmarksTitle')} info={t('trading.factsheetBenchmarksInfo')} />
        {capture ? <Factsheet_Capture table={capture} asset={asset} /> : hint}
        {scatter && scatter.points.length > 0 && <Factsheet_Scatter curve={scatter} asset={asset} />}
      </section>
    </div>
  );
};

export default Run_Summary;
