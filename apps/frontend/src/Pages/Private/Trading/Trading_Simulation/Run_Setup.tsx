import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSimulationReport } from '../../../../Hooks/Trading/useSimulation';
import type { Duration_Payload, Report_Block, Simulation_Run } from '../../../../Hooks/Trading/useSimulation';
import { formatNumber, formatPrice } from '../Trading_Simulator/format';
import { fromRun } from '../Trading_Simulator/simulationForm';
import { valueLabel } from '../Trading_Simulator/valueLabels';
import Factsheet_By_Entry from './Factsheet_By_Entry';
import Factsheet_Card from './Factsheet_Card';
import Factsheet_Entries from './Factsheet_Entries';
import Factsheet_Execution_Variants from './Factsheet_Execution_Variants';
import Factsheet_Context_Rules from './Factsheet_Context_Rules';
import Factsheet_Funnel from './Factsheet_Funnel';
import Factsheet_Heading from './Factsheet_Heading';
import Factsheet_Setup_Funnel from './Factsheet_Setup_Funnel';
import Factsheet_Order_Types from './Factsheet_Order_Types';
import Factsheet_Order_Variants from './Factsheet_Order_Variants';
import Factsheet_Explain from './Factsheet_Explain';
import './Run_Summary.scss';

interface Run_Setup_Props {
  run: Simulation_Run;
}

interface Setup_Row {
  label: string;
  value: string;
}

const SETUP_BLOCKS: Report_Block[] = [
  'dataQuality',
  'signalFunnel',
  'entryBreakdown',
  'setupFunnel',
  'contextRules',
  'orderExecution',
  'orderTypes',
  'orderVariants',
  'executionVariants',
];

// As moedas que se mostram como $
const DOLLAR_QUOTES = ['USDT', 'USDC', 'USD'];

// Um cartão da ficha: o título, o que mostra e as linhas
const Setup_Card = ({ title, note, rows, explain }: { title: string; note: string; rows: Setup_Row[]; explain: string }) => (
  <div className="Factsheet_Panel Factsheet_Sheet_Card">
    <div className="Factsheet_Panel_Header">
      <div className="Factsheet_Panel_Heading">
        <span className="Factsheet_Panel_Title">
          {title}
          <Factsheet_Explain id={explain} title={title} />
        </span>
        <span className="Factsheet_Panel_Note">{note}</span>
      </div>
    </div>
    <dl className="Factsheet_Sheet_List">
      {rows.map((row) => (
        <div key={row.label} className="Factsheet_Sheet_Row">
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  </div>
);

/**
 * O ecrã 2 de uma simulação, a Estratégia. A 2.1 — Ficha de simulação: a
 * configuração para repetir a corrida (a que a simulação gravou, só com as opções
 * que estavam ligadas) e a qualidade das velas que usou, que o simulador calculou
 * no fim (`dataQuality`).
 */
const Run_Setup = ({ run }: Run_Setup_Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { report, loading } = useSimulationReport(run.id, SETUP_BLOCKS, run.status === 'done');
  const quality = report?.dataQuality;
  const funnel = report?.signalFunnel;
  const byEntry = report?.entryBreakdown;
  const setupFunnel = report?.setupFunnel;
  const contextRules = report?.contextRules;
  const orders = report?.orderExecution;
  const orderTypes = report?.orderTypes;
  const orderVariants = report?.orderVariants;
  const executionVariants = report?.executionVariants;
  const form = useMemo(() => fromRun(run), [run]);
  const strategy = run.strategy;
  const futures = run.instrument.type !== 'spot';

  const unit = DOLLAR_QUOTES.includes(run.instrument.quote) ? '$' : run.instrument.quote;
  const number = (value: number, digits = 0) => formatNumber(value, language, digits);
  // Sem casas a mais: 0,1 e não 0,10
  const short = (value: number) => {
    const digits = Number.isInteger(value) ? 0 : Number.isInteger(value * 10) ? 1 : Number.isInteger(value * 100) ? 2 : 4;
    return formatNumber(value, language, digits);
  };
  const money = (value: number) => `${short(value)} ${unit}`;
  const pct = (value: number) => `${short(value)}%`;
  const day = useMemo(
    () => new Intl.DateTimeFormat(language, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }),
    [language],
  );
  const date = (value: string | number) => day.format(new Date(value));
  const duration = (value: Duration_Payload) => `${value.count} ${t(`trading.unit_${value.unit}`)}`;
  const off = t('trading.shOff');

  // --- Geral ------------------------------------------------------------------
  const deposits =
    strategy.depositEvery && (strategy.depositAmount ?? 0) > 0
      ? [
          t('trading.shDepositEvery', {
            amount: money(strategy.depositAmount ?? 0),
            period: t(`trading.depositShort_${strategy.depositEvery}`).toLowerCase(),
          }),
          strategy.depositIncrease
            ? t('trading.shDepositIncrease', {
                amount: money(strategy.depositIncrease.amount),
                period: t(`trading.depositShort_${strategy.depositIncrease.every}`).toLowerCase(),
              })
            : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : off;
  const feeEntry = strategy.feeEntryPct ?? strategy.feePct;
  const feeExit = strategy.feeExitPct ?? strategy.feePct;

  const general: Setup_Row[] = [
    {
      label: t('trading.shMarket'),
      value: `${run.instrument.symbol} · ${t(`trading.type_${run.instrument.type}`)}${futures ? ' USDⓈ-M' : ''}`,
    },
    { label: t('trading.shTimeframe'), value: t(`trading.tf_${run.timeframe}`) },
    { label: t('trading.shPeriod'), value: `${date(run.fromDate)} – ${date(run.toDate)}` },
    { label: t('trading.shTimezone'), value: strategy.timezone ?? 'UTC' },
    ...(quality
      ? [
          {
            label: t('trading.shWarmup'),
            value: quality.warmupFromTime != null
              ? t('trading.shWarmupValue', { count: number(quality.warmupBars), from: date(quality.warmupFromTime) })
              : number(quality.warmupBars),
          },
        ]
      : []),
    { label: t('trading.shInitialCapital'), value: money(strategy.initialCapital) },
    { label: t('trading.shDeposits'), value: deposits },
    ...(futures
      ? [
          {
            label: t('trading.shLeverage'),
            value: [
              `${short(strategy.leverage ?? 1)}×`,
              t(`trading.margin_${strategy.marginMode ?? 'isolated'}`).toLowerCase(),
              strategy.maintenanceMarginPct != null ? t('trading.shMaintenance', { pct: pct(strategy.maintenanceMarginPct) }) : null,
            ]
              .filter(Boolean)
              .join(' · '),
          },
          {
            label: t('trading.shFunding'),
            value: !strategy.funding
              ? off
              : strategy.funding.mode === 'fixed'
                ? t('trading.shFundingFixed', { pct: pct(strategy.funding.ratePct ?? 0) })
                : t('trading.shFundingHistorical'),
          },
        ]
      : []),
    { label: t('trading.shFees'), value: `${pct(feeEntry)} / ${pct(feeExit)} · ${pct(strategy.slippagePct ?? 0)}` },
    { label: t('trading.shExecution'), value: t(`trading.execution_${strategy.executionPrice ?? 'open'}`) },
    {
      label: t('trading.shOutOfSample'),
      value: strategy.outOfSamplePct ? t('trading.shOutOfSampleValue', { pct: short(strategy.outOfSamplePct) }) : off,
    },
    {
      // O desafio de prop firm: as regras que contam, numa linha
      label: t('trading.opt_propFirm'),
      value: strategy.propFirm
        ? [
            strategy.propFirm.dailyLossPct != null && t('trading.shPropDaily', { pct: pct(strategy.propFirm.dailyLossPct) }),
            strategy.propFirm.maxLossPct != null && t('trading.shPropMax', { pct: pct(strategy.propFirm.maxLossPct) }),
            strategy.propFirm.profitTargetPct != null && t('trading.shPropTarget', { pct: pct(strategy.propFirm.profitTargetPct) }),
            t('trading.shPropDays', { count: strategy.propFirm.days ?? 30 }),
          ]
            .filter(Boolean)
            .join(' · ')
        : off,
    },
  ];

  // --- Indicadores e regras -----------------------------------------------------
  const sizing = strategy.sizing ?? { mode: 'all' as const };
  const sizingText =
    sizing.mode === 'all'
      ? t('trading.sizing_all')
      : sizing.mode === 'amount'
        ? money(sizing.value ?? 0)
        : t(`trading.shSizing_${sizing.mode}`, { pct: pct(sizing.value ?? 0) });
  const compounding = t(`trading.compoundingShort_${strategy.compounding === false ? 'no' : 'yes'}`).toLowerCase();
  const limits = strategy.dailyLimits ?? {};
  const orderSize = [strategy.quantityStep, strategy.minQuantity, strategy.minNotional];

  const rules: Setup_Row[] = [
    ...(strategy.indicators ?? []).map((indicator) => ({
      label: indicator.name || `${indicator.kind.toUpperCase()}${indicator.period}`,
      value: [
        t(`trading.shKind_${indicator.kind}`, { period: indicator.period }),
        t(`trading.field_${indicator.field}`).toLowerCase(),
        indicator.timeframe ? t(`trading.tf_${indicator.timeframe}`) : null,
        indicator.shift ? t('trading.shShift', { count: indicator.shift }) : null,
        indicator.smoothing
          ? t('trading.shSmoothing', {
              kind: t(`trading.kindLong_${indicator.smoothing.kind}`).toLowerCase(),
              period: indicator.smoothing.period,
            })
          : null,
      ]
        .filter(Boolean)
        .join(' · '),
    })),
    { label: t('trading.shMaxPositions'), value: number(strategy.maxPositions ?? 1) },
    { label: t('trading.shOpposite'), value: t(`trading.opposite_${strategy.opposite ?? 'ignore'}`) },
    { label: t('trading.shSizing'), value: `${sizingText} · ${compounding}` },
    ...(strategy.sizingRules ?? []).map((rule, index) => ({
      label: t('trading.shSizingRule', { index: index + 1 }),
      value: [
        `${rule.count} ${t(`trading.streak_${rule.after}`)} ${t('trading.shInARow')}`,
        '→',
        rule.action === 'reset'
          ? t('trading.shRuleReset')
          : rule.action === 'multiply'
            ? `×${short(rule.value ?? 1)}`
            : sizing.mode === 'amount'
              ? money(rule.value ?? 0)
              : pct(rule.value ?? 0),
        rule.trades ? t('trading.shRuleTrades', { count: rule.trades }) : null,
      ]
        .filter(Boolean)
        .join(' '),
    })),
    ...(orderSize.some((value) => (value ?? 0) > 0)
      ? [
          {
            label: t('trading.shOrderSize'),
            value: `${short(strategy.quantityStep ?? 0)} · ${short(strategy.minQuantity ?? 0)} · ${money(strategy.minNotional ?? 0)}`,
          },
        ]
      : []),
    ...((strategy.cooldownBars ?? 0) > 0
      ? [
          {
            label: t('trading.shCooldown'),
            value: t('trading.shCooldownValue', {
              count: strategy.cooldownBars,
              after: t(`trading.cooldown_${strategy.cooldownAfter ?? 'any'}`).toLowerCase(),
            }),
          },
        ]
      : []),
    ...(strategy.excludedPeriods ?? []).map((period, index) => ({
      label: t('trading.shExcluded', { index: index + 1 }),
      value: `${date(period.from)} – ${date(period.to)}`,
    })),
    ...((strategy.blockedTimes ?? []).length
      ? [{ label: t('trading.shBlocked'), value: t('trading.shBlockedValue', { count: strategy.blockedTimes?.length }) }]
      : []),
    ...(limits.maxLosses || limits.maxLossPct
      ? [
          {
            label: t('trading.shDailyLimits'),
            value: [
              limits.maxLosses ? t('trading.shDailyLosses', { count: limits.maxLosses }) : null,
              limits.maxLossPct ? pct(limits.maxLossPct) : null,
            ]
              .filter(Boolean)
              .join(` ${t('trading.shOr')} `),
          },
        ]
      : []),
    ...(strategy.tradingGuards ?? []).map((guard, index) => ({
      label: t('trading.shGuard', { index: index + 1 }),
      value: `${short(guard.value)} ${t(`trading.guard_${guard.event}`, { quote: unit })} ${
        guard.window ? t('trading.shGuardWithin', { window: duration(guard.window) }) : t('trading.shGuardEver')
      } → ${t('trading.shGuardPause', { pause: duration(guard.pause) })}`,
    })),
  ];

  // --- Qualidade dos dados --------------------------------------------------------
  const data: Setup_Row[] = quality
    ? [
        { label: t('trading.shSimulatedBars'), value: number(quality.simulatedBars) },
        { label: t('trading.shWarmupBars'), value: number(quality.warmupBars) },
        {
          label: t('trading.shMissingBars'),
          value: t('trading.shMissingValue', { bars: number(quality.missingBars), minutes: number(quality.missingMinutes) }),
        },
        { label: t('trading.shGaps', { pct: short(quality.gapThresholdPct) }), value: number(quality.openingGaps) },
        { label: t('trading.shAverageRange'), value: quality.averageRangePct != null ? `${number(quality.averageRangePct, 2)}%` : '—' },
        {
          label: t('trading.shMaxRange'),
          value:
            quality.maxRangePct != null && quality.maxRangeTime != null
              ? `${number(quality.maxRangePct, 2)}% · ${date(quality.maxRangeTime)}`
              : '—',
        },
        {
          label: t('trading.shPrices'),
          value:
            quality.startPrice != null && quality.endPrice != null
              ? `${formatPrice(quality.startPrice, language)} → ${formatPrice(quality.endPrice, language)}`
              : '—',
        },
        { label: t('trading.shVolatility'), value: quality.volatilityPct != null ? `${number(quality.volatilityPct, 0)}%` : '—' },
        {
          label: t('trading.shSource'),
          value: `${t(`trading.shSource_${run.instrument.source}`, { defaultValue: run.instrument.source })} · ${t(`trading.type_${run.instrument.type}`)}`,
        },
      ]
    : [];

  // --- Ordens e preço de execução -------------------------------------------------
  const read = (text: string) => Number(text.replace(',', '.'));
  const levelEntries = form.entries
    .map((entry, index) => ({ entry, name: entry.name.trim() || t('trading.entryTitle', { position: index + 1 }) }))
    .filter(({ entry }) => entry.price.kind !== 'market');
  const levelNames = levelEntries.map(({ name }) => `«${name}»`).join(', ');
  const ordersInfo = [
    ...levelEntries.map(({ entry, name }) => {
      const bars = read(entry.orderBars) || 1;
      return t('trading.fsOrdersInfoLevel', {
        name,
        detail: [
          valueLabel(entry.price, form.indicators, t),
          t('trading.shBars', { count: bars }),
          bars > 1 ? t(`trading.fsVariantTrack_${entry.orderTrack ? 'yes' : 'no'}`) : null,
          bars > 1 && entry.orderCancel ? t('trading.shOrderCancels') : null,
        ]
          .filter(Boolean)
          .join(', '),
      });
    }),
    !levelEntries.length
      ? t('trading.fsOrdersInfoNone')
      : levelEntries.length < form.entries.length
        ? t('trading.fsOrdersInfoOthers')
        : null,
    t('trading.factsheetOrdersInfo'),
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="Run_Summary">
      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.setupSheetTitle')} info={t('trading.setupSheetInfo')} />
        <div className="Factsheet_Sheet_Grid">
          <Setup_Card title={t('trading.shGeneralTitle')} note={t('trading.shGeneralNote')} rows={general} explain="setupGeneral" />
          <Setup_Card title={t('trading.shRulesTitle')} note={t('trading.shRulesNote')} rows={rules} explain="setupRules" />
          {quality ? (
            <Setup_Card title={t('trading.shDataTitle')} note={t('trading.shDataNote')} rows={data} explain="setupData" />
          ) : (
            <span className="Factsheet_Hint">
              {t(loading ? 'common.loading' : run.status === 'done' ? 'trading.factsheetMissing' : run.status === 'cancelled' ? 'trading.factsheetCancelled' : 'trading.factsheetPending')}
            </span>
          )}
        </div>
        <Factsheet_Entries run={run} />
      </section>
      <section className="Factsheet_Section">
        <Factsheet_Heading
          title={t('trading.factsheetFunnelTitle')}
          tag={t('trading.factsheetFunnelTag')}
          info={t('trading.factsheetFunnelInfo')}
        />
        {funnel && <Factsheet_Funnel funnel={funnel} />}
        {byEntry && byEntry.entries.length > 0 && <Factsheet_By_Entry table={byEntry} run={run} />}
        {setupFunnel?.available && <Factsheet_Setup_Funnel table={setupFunnel} run={run} />}
        {contextRules?.available && <Factsheet_Context_Rules table={contextRules} run={run} />}
        {!funnel && (
          <span className="Factsheet_Hint">
            {t(loading ? 'common.loading' : run.status === 'done' ? 'trading.factsheetMissing' : run.status === 'cancelled' ? 'trading.factsheetCancelled' : 'trading.factsheetPending')}
          </span>
        )}
      </section>
      <section className="Factsheet_Section">
        <Factsheet_Heading title={t('trading.factsheetOrdersTitle')} info={ordersInfo} />
        {orders ? (
          <div className="Factsheet_Cards">
            <Factsheet_Card
              label={t('trading.fsOrdPlaced')}
              help={t('trading.fsHelp_ordPlaced')}
              explain="setupOrdPlaced"
              value={number(orders.placed)}
              detail={
                levelEntries.length
                  ? t('trading.fsOrdPlacedBy', { count: levelEntries.length, names: levelNames })
                  : t('trading.fsOrdPlacedNone')
              }
            />
            <Factsheet_Card
              label={t('trading.fsOrdFilled')}
              help={t('trading.fsHelp_ordFilled')}
              explain="setupOrdFilled"
              value={orders.executedPct == null ? '—' : `${number(orders.executedPct, 0)}%`}
              detail={t('trading.fsOrdFilledOf', { filled: number(orders.filled), placed: number(orders.placed) })}
            />
            <Factsheet_Card
              label={t('trading.fsOrdExpired')}
              help={t('trading.fsHelp_ordExpired')}
              explain="setupOrdExpired"
              value={number(orders.expired)}
              detail={
                orders.orderBars.length === 1
                  ? t('trading.fsOrdExpiredDetail', { count: orders.orderBars[0] })
                  : t('trading.fsOrdExpiredLate')
              }
            />
            <Factsheet_Card
              label={t('trading.fsOrdCancelled')}
              help={t('trading.fsHelp_ordCancelled')}
              explain="setupOrdCancelled"
              value={number(orders.cancelled)}
              detail={t('trading.fsOrdCancelledDetail')}
            />
            <Factsheet_Card
              label={t('trading.fsOrdWait')}
              help={t('trading.fsHelp_ordWait')}
              explain="setupOrdWait"
              value={orders.avgWaitBars == null ? '—' : t('trading.fsBarsValue', { value: number(orders.avgWaitBars, 1) })}
              detail={t('trading.fsOrdWaitDetail')}
            />
            <Factsheet_Card
              label={t('trading.fsOrdSaved')}
              help={t('trading.fsHelp_ordSaved')}
              explain="setupOrdSaved"
              value={`${number(orders.slippageSaved)} ${unit}`}
              detail={t('trading.fsOrdSavedDetail')}
              tone={orders.slippageSaved > 0 ? 'Positive' : ''}
            />
          </div>
        ) : (
          <span className="Factsheet_Hint">
            {t(loading ? 'common.loading' : run.status === 'done' ? 'trading.factsheetMissing' : run.status === 'cancelled' ? 'trading.factsheetCancelled' : 'trading.factsheetPending')}
          </span>
        )}
        {orderTypes && orderTypes.rows.length > 0 && <Factsheet_Order_Types table={orderTypes} run={run} />}
        {orderVariants && orderVariants.entries.length > 0 && <Factsheet_Order_Variants table={orderVariants} run={run} />}
        {executionVariants && executionVariants.rows.length > 0 && <Factsheet_Execution_Variants table={executionVariants} />}
      </section>
    </div>
  );
};

export default Run_Setup;
