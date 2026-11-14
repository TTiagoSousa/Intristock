import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import { TRADES_PAGE_SIZE, useSimulationTrades } from '../../../../Hooks/Trading/useSimulation';
import type {
  Simulation_Result as Result,
  Sample_Result,
  Simulation_Run,
  Trades_Filter,
} from '../../../../Hooks/Trading/useSimulation';
import { Close } from '../../../../Imports/icons';
import { chartExitKeyOf, entryLabel, exitLabel, exitTone } from './labels';
import Segmented from './Segmented';
import { entriesOf } from './simulationForm';
import { formatDateTime, formatDay, formatNumber, formatPct, formatPrice, formatSigned, toneOf } from './format';

// A ordem dos motivos de saída no resumo
const EXIT_REASONS = [
  'stop_loss',
  'trailing_stop',
  'break_even',
  'take_profit',
  'signal',
  'time',
  'liquidation',
  'opposite',
  'excluded',
  'end',
];

// Quantidades na moeda do ativo: 0,01234567 BTC / 12,3456 ETH
const formatAmount = (value: number, language: string) =>
  formatNumber(value, language, Math.abs(value) >= 100 ? 2 : Math.abs(value) >= 1 ? 4 : 8);

interface Metric {
  label: string;
  value: string;
  detail?: string;
  tone?: string;
}

/** O resultado final de uma simulação acabada e a lista dos trades. */
const Simulation_Result = ({ run, result }: { run: Simulation_Run; result: Result }) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const [page, setPage] = useState(1);
  // Só os trades de um par entrada → saída (uma linha do resumo)
  const [filter, setFilter] = useState<Required<Trades_Filter> | null>(null);
  const { trades, total, loading } = useSimulationTrades(run.id, page, filter ?? {});
  const entries = entriesOf(run.strategy);

  const toggleFilter = (next: Required<Trades_Filter>) => {
    const same = filter?.entryRule === next.entryRule && filter.exit === next.exit;
    setFilter(same ? null : next);
    setPage(1);
  };

  const quote = run.instrument.quote;
  const base = run.instrument.asset.ticker ?? run.instrument.symbol;
  const pair = `${base}/${quote}`;
  const money = (value: number) => `${formatNumber(value, language)} ${quote}`;
  // Em que moeda se veem o capital e o lucro: a de cotação ou a do ativo
  const [currency, setCurrency] = useState<'quote' | 'base'>('quote');
  const inBase = currency === 'base' && result.inBase ? result.inBase : null;
  const coins = (value: number) => `${formatAmount(value, language)} ${base}`;

  const reasons = EXIT_REASONS.filter((reason) => result.exitReasons[reason]).map(
    (reason) => `${t(`trading.exitShort_${reason}`)} ${result.exitReasons[reason]}`,
  );

  const capitalMetrics: Metric[] = inBase
    ? [
        {
          label: t('trading.finalCapital'),
          value: coins(inBase.final),
          detail: inBase.deposits
            ? t('trading.fromCapitalDeposits', { capital: coins(inBase.initial), deposits: coins(inBase.deposits) })
            : t('trading.fromCapital', { capital: coins(inBase.initial) }),
        },
        {
          label: t('trading.netProfit'),
          value: formatPct(inBase.netProfitPct, language),
          detail: t('trading.inBaseHint', { base }),
          tone: toneOf(inBase.netProfitPct),
        },
      ]
    : [
        {
          label: t('trading.finalCapital'),
          value: money(result.finalCapital),
          detail: result.totalDeposits
            ? t('trading.fromCapitalDeposits', {
                capital: money(result.initialCapital),
                deposits: money(result.totalDeposits),
              })
            : t('trading.fromCapital', { capital: money(result.initialCapital) }),
        },
        {
          label: t('trading.netProfit'),
          value: formatPct(result.netProfitPct, language),
          detail: `${formatSigned(result.netProfit, language)} ${quote}`,
          tone: toneOf(result.netProfit),
        },
      ];

  const metrics: Metric[] = [
    ...capitalMetrics,
    {
      label: t('trading.tradesCount'),
      value: String(result.trades),
      detail: t('trading.winsLosses', { wins: result.wins, losses: result.losses }),
    },
    {
      label: t('trading.winRate'),
      value: result.winRate == null ? '—' : `${formatNumber(result.winRate, language, 1)}%`,
    },
    {
      label: t('trading.profitFactor'),
      value: result.profitFactor == null ? '—' : formatNumber(result.profitFactor, language),
    },
    {
      label: t('trading.maxDrawdown'),
      value: `${formatNumber(result.maxDrawdownPct, language)}%`,
      tone: result.maxDrawdownPct > 0 ? 'Loss' : '',
    },
    {
      label: t('trading.avgTrade'),
      value: formatPct(result.avgTradePct, language),
      tone: toneOf(result.avgTradePct),
    },
    {
      label: t('trading.bestWorst'),
      value: `${formatPct(result.bestTradePct, language)} / ${formatPct(result.worstTradePct, language)}`,
    },
    { label: t('trading.totalFees'), value: money(result.totalFees) },
    ...(result.totalSlippage ? [{ label: t('trading.totalSlippage'), value: money(result.totalSlippage) }] : []),
    ...(result.totalFunding
      ? [
          {
            label: t('trading.totalFunding'),
            value: `${formatSigned(-result.totalFunding, language)} ${quote}`,
            detail: t('trading.totalFundingHint'),
            tone: toneOf(-result.totalFunding),
          },
        ]
      : []),
    ...(result.maxOpenPositions && result.maxOpenPositions > 1
      ? [{ label: t('trading.maxOpenPositions'), value: String(result.maxOpenPositions) }]
      : []),
    ...(result.skippedOrders
      ? [{ label: t('trading.skippedOrders'), value: String(result.skippedOrders), detail: t('trading.skippedOrdersHint') }]
      : []),
    inBase
      ? { label: t('trading.buyHold'), value: formatPct(0, language), detail: t('trading.buyHoldBaseHint', { base }) }
      : {
          label: t('trading.buyHold'),
          value: formatPct(result.buyHoldPct, language),
          detail: t('trading.buyHoldHint'),
          tone: toneOf(result.buyHoldPct),
        },
    ...(result.longs != null && result.shorts != null
      ? [{ label: t('trading.longsShorts'), value: `${result.longs} / ${result.shorts}` }]
      : []),
    ...(result.byEntry && result.byEntry.length > 1
      ? result.byEntry.map((entry) => ({
          label: t('trading.entryResult', { name: entryLabel(entries, entry.rule, t), side: t(`trading.side_${entry.side}`) }),
          value: `${formatSigned(entry.pnl, language)} ${quote}`,
          detail: t('trading.entryResultDetail', { trades: entry.trades, wins: entry.wins }),
          tone: toneOf(entry.pnl),
        }))
      : []),
    { label: t('trading.exits'), value: reasons.join(' · ') || '—', tone: 'Compact' },
  ];

  // Dentro e fora da amostra, lado a lado
  const samples = result.samples;
  const sampleRows: { label: string; value: (sample: Sample_Result) => string; tone?: (sample: Sample_Result) => string }[] = [
    { label: t('trading.tradesCount'), value: (sample) => String(sample.trades) },
    {
      label: t('trading.netProfit'),
      value: (sample) =>
        `${formatPct(sample.netProfitPct, language)} (${formatSigned(sample.netProfit, language)} ${quote})`,
      tone: (sample) => toneOf(sample.netProfit),
    },
    {
      label: t('trading.winRate'),
      value: (sample) => (sample.winRate == null ? '—' : `${formatNumber(sample.winRate, language, 1)}%`),
    },
    {
      label: t('trading.profitFactor'),
      value: (sample) => (sample.profitFactor == null ? '—' : formatNumber(sample.profitFactor, language)),
    },
    { label: t('trading.maxDrawdown'), value: (sample) => `${formatNumber(sample.maxDrawdownPct, language)}%` },
    {
      label: t('trading.buyHold'),
      value: (sample) => formatPct(sample.buyHoldPct, language),
      tone: (sample) => toneOf(sample.buyHoldPct),
    },
  ];
  const showFunding = Boolean(result.totalFunding);

  const totalPages = Math.max(1, Math.ceil(total / TRADES_PAGE_SIZE));
  const byExit = result.byExit ?? [];

  return (
    <>
      <div className="Page_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('trading.result')}</span>
            <span className="Card_Subtitle">
              {pair} · {t(`trading.type_${run.instrument.type}`)} · {t(`trading.tf_${run.timeframe}`)} ·{' '}
              {formatDay(result.firstBarTime, language)} – {formatDay(result.lastBarTime, language)}
            </span>
          </div>

          {result.inBase && (
            <div className="Card_Header_Actions">
              <Segmented
                label={t('trading.resultCurrency')}
                value={currency}
                options={[
                  { value: 'quote', label: quote },
                  { value: 'base', label: base },
                ]}
                onChange={setCurrency}
              />
            </div>
          )}
        </div>

        <div className="Card_Body">
          <div className="Result_Metrics">
            {metrics.map((metric) => (
              <div key={metric.label} className="Result_Metric">
                <span className="Result_Metric_Label">{metric.label}</span>
                <strong className={`Result_Metric_Value ${metric.tone ?? ''}`}>{metric.value}</strong>
                {metric.detail && <span className="Result_Metric_Detail">{metric.detail}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {samples && (
        <div className="Page_Card">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('trading.samplesTitle')}</span>
              <span className="Card_Subtitle">
                {t('trading.samplesSubtitle', {
                  pct: formatNumber(samples.splitPct, language, 0),
                  date: formatDateTime(samples.splitTime, language),
                })}
              </span>
            </div>
          </div>

          <div className="Card_Body">
            <div className="Trades_Table_Scroll">
              <table className="Trades_Table Samples_Table">
                <thead>
                  <tr>
                    <th />
                    <th className="Right">{t('trading.inSample')}</th>
                    <th className="Right">{t('trading.outOfSample')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      {[samples.inSample, samples.outOfSample].map((sample, index) => (
                        <td key={index} className={`Numeric ${row.tone?.(sample) ?? ''}`}>
                          {row.value(sample)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <span className="Simulator_Hint">{t('trading.samplesHint')}</span>
          </div>
        </div>
      )}

      {byExit.length > 0 && (
        <div className="Page_Card">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('trading.byExitTitle')}</span>
              <span className="Card_Subtitle">{t('trading.byExitSubtitle')}</span>
            </div>
          </div>

          <div className="Card_Body">
            <div className="Trades_Table_Scroll">
              <table className="Trades_Table By_Exit_Table">
                <thead>
                  <tr>
                    <th>{t('trading.enteredBy')}</th>
                    <th>{t('trading.exitedBy')}</th>
                    <th className="Right">{t('trading.tradesCount')}</th>
                    <th className="Right">{t('trading.winRateShort')}</th>
                    <th className="Right">{t('trading.pnl')}</th>
                  </tr>
                </thead>
                <tbody>
                  {byExit.map((row) => {
                    const side = entries[row.rule - 1]?.side ?? 'long';
                    const active = filter?.entryRule === row.rule && filter.exit === row.exit;
                    return (
                      <tr
                        key={`${row.rule}|${row.exit}`}
                        className={`Clickable${active ? ' Active' : ''}`}
                        tabIndex={0}
                        aria-pressed={active}
                        onClick={() => toggleFilter({ entryRule: row.rule, exit: row.exit })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleFilter({ entryRule: row.rule, exit: row.exit });
                          }
                        }}
                      >
                        <td>
                          <span className={`Side_Badge ${side}`}>{entryLabel(entries, row.rule, t)}</span>
                        </td>
                        <td>
                          <span className={`Exit_Badge ${exitTone(row.exit)}`}>
                            {exitLabel(entries, row.rule, row.exit, t)}
                          </span>
                        </td>
                        <td className="Numeric">{row.trades}</td>
                        <td className="Numeric">{formatNumber((row.wins / row.trades) * 100, language, 1)}%</td>
                        <td className={`Numeric ${toneOf(row.pnl)}`}>{formatSigned(row.pnl, language)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="Page_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('trading.trades')}</span>
            <span className="Card_Subtitle">{t('trading.tradesSubtitle', { count: result.trades })}</span>
          </div>

          {filter && (
            <button type="button" className="Trades_Filter" onClick={() => toggleFilter(filter)} title={t('trading.clearFilter')}>
              {t('trading.filterShowing', {
                entry: entryLabel(entries, filter.entryRule, t),
                exit: exitLabel(entries, filter.entryRule, filter.exit, t),
              })}
              <Close />
            </button>
          )}
        </div>

        <div className="Card_Body">
          {result.trades === 0 ? (
            <span className="Empty_Message">{t('trading.noTrades')}</span>
          ) : (
            <>
              <div className="Trades_Table_Scroll">
                <table className="Trades_Table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t('trading.entryRule')}</th>
                      <th>{t('trading.entry')}</th>
                      <th className="Right">{t('trading.price')}</th>
                      <th>{t('trading.exit')}</th>
                      <th className="Right">{t('trading.price')}</th>
                      <th>{t('trading.exitReason')}</th>
                      <th className="Right">{t('trading.pnl')}</th>
                      <th className="Right">%</th>
                      {showFunding && <th className="Right">{t('trading.funding')}</th>}
                      <th className="Right">{t('trading.equity')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={showFunding ? 11 : 10} className="Trades_Message">{t('common.loading')}</td>
                      </tr>
                    ) : (
                      trades.map((trade) => (
                        <tr key={trade.index}>
                          <td className="Numeric Left">{trade.index}</td>
                          <td>
                            <span className={`Side_Badge ${trade.side}`} title={t(`trading.side_${trade.side}`)}>
                              {entryLabel(entries, trade.entryRule, t)}
                            </span>
                          </td>
                          <td className="Numeric Left">{formatDateTime(trade.entryTime, language)}</td>
                          <td className="Numeric">{formatPrice(trade.entryPrice, language)}</td>
                          <td className="Numeric Left">{formatDateTime(trade.exitTime, language)}</td>
                          <td className="Numeric">{formatPrice(trade.exitPrice, language)}</td>
                          <td>
                            <span className={`Exit_Badge ${trade.exitReason}`}>
                              {exitLabel(entries, trade.entryRule, chartExitKeyOf(trade), t)}
                            </span>
                          </td>
                          <td className={`Numeric ${toneOf(trade.pnl)}`}>{formatSigned(trade.pnl, language)}</td>
                          <td className={`Numeric ${toneOf(trade.pnlPct)}`}>{formatPct(trade.pnlPct, language)}</td>
                          {showFunding && (
                            <td className={`Numeric ${toneOf(-(trade.funding ?? 0))}`}>
                              {formatSigned(-(trade.funding ?? 0), language)}
                            </td>
                          )}
                          <td className="Numeric">{formatNumber(trade.equity, language)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <Global_Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={filter ? total : total || result.trades}
                pageSize={TRADES_PAGE_SIZE}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Simulation_Result;
