import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Company } from '../../../../Hooks/Companies/useCompanies';
import { useMonthlyPayments, type MonthlyPaymentsFilters } from '../../../../Hooks/Companies/useMonthlyPayments';
import {
  useCompanySupplierGroupOptions,
  useCompanySupplierOptions,
} from '../../../../Hooks/Companies/useCompanyOptions';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Month_Chart, { type Month_Chart_Series } from '../../../../Components/Charts/Month_Chart/Month_Chart';
import { localMonth } from '../../../../utils/dates';
import { localeOf } from '../../../../utils/locale';

type Chart_Kind = 'bars' | 'lines';
type Serie_Key = 'receive' | 'pay' | 'plannedPay';

// Os períodos que se escolhem, em meses para trás; `custom` = as datas à mão
const PERIODS = [6, 12, 24] as const;
// Quantos meses à frente se mostram (a previsão)
const FUTURES = [0, 3, 6, 12] as const;

const CHART_KIND_KEY = 'intristock-expenses-chart';

const DEFAULT_FILTERS: MonthlyPaymentsFilters = {
  months: 12,
  future: 0,
  from: '',
  to: '',
  supplierId: '',
  supplierGroupId: '',
  includeDrafts: false,
};

// Os do período não contam para o "Limpar filtros"
const PERIOD_KEYS: (keyof MonthlyPaymentsFilters)[] = ['months', 'future', 'from', 'to'];

const readKind = (): Chart_Kind => {
  try {
    return localStorage.getItem(CHART_KIND_KEY) === 'lines' ? 'lines' : 'bars';
  } catch {
    return 'bars';
  }
};

// O mês de hoje no browser (não em UTC)
const currentMonth = () => localMonth();

// Vazio (null) onde a linha não deve passar: o realizado nos meses futuros e a
// previsão nos meses sem ela
interface Point {
  label: string;
  pay: number | null;
  receive: number | null;
  plannedPay: number | null;
  payCount: number;
  receiveCount: number;
  plannedCount: number;
}

const COUNT_OF: Record<Serie_Key, 'payCount' | 'receiveCount' | 'plannedCount'> = {
  receive: 'receiveCount',
  pay: 'payCount',
  plannedPay: 'plannedCount',
};

/**
 * Receitas vs despesas de cada mês (na moeda da empresa), em barras ou em
 * linha, com os filtros por cima: o período (os últimos meses ou as datas à
 * mão), os meses à frente, o fornecedor, o grupo e os rascunhos. A previsão são
 * os salários e recibos verdes por pagar, por cima das despesas, mais clara. As
 * contas são do backend; a escolha barras/linhas fica no browser.
 */
const Payments_Chart = ({ company }: { company: Company }) => {
  const { t, i18n } = useTranslation();
  const groupId = useId();
  const { formatIn } = useCurrencyFormat();
  const [kind, setKind] = useState<Chart_Kind>(readKind);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  // As datas à mão: só vão ao backend com as duas escritas
  const [custom, setCustom] = useState(false);
  const { data, error } = useMonthlyPayments(company.id, custom ? filters : { ...filters, from: '', to: '' });
  const { suppliers } = useCompanySupplierOptions(company.id);
  const { groups } = useCompanySupplierGroupOptions(company.id);

  const setFilter = <K extends keyof MonthlyPaymentsFilters>(key: K, value: MonthlyPaymentsFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const chooseKind = (next: Chart_Kind) => {
    setKind(next);
    try {
      localStorage.setItem(CHART_KIND_KEY, next);
    } catch {
      // Sem armazenamento fica só nesta visita
    }
  };

  // Ao abrir as datas propõe-se o que já estava à vista
  const openCustom = () => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - (filters.months - 1), 1));
    const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + filters.future, 1));
    setFilters((current) => ({
      ...current,
      from: current.from || start.toISOString().slice(0, 7),
      to: current.to || end.toISOString().slice(0, 7),
    }));
    setCustom(true);
  };

  const locale = localeOf(i18n.language);
  // O sinal fica antes do símbolo: "-€17,87" e não "€-17,87"
  const format = (value: number) => `${value < 0 ? '-' : ''}${formatIn(Math.abs(value), company.currency)}`;
  const monthDate = (month: string) => new Date(`${month}-01T00:00:00Z`);
  // No eixo "nov 25" (com o mês e o ano juntos o pt-PT escreve "11/2025"); na caixa, por extenso
  const shortLabel = (month: string) =>
    `${monthDate(month).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }).replace('.', '')} ${month.slice(2, 4)}`;
  const longLabel = (month: string) =>
    monthDate(month).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const points: (Point & { month: string; future: boolean; short: string })[] = (data ?? []).map((entry) => ({
    ...entry,
    receive: entry.future && entry.receiveCount === 0 ? null : entry.receive,
    pay: entry.future && entry.payCount === 0 ? null : entry.pay,
    plannedPay: entry.plannedCount === 0 && !entry.future ? null : entry.plannedPay,
    short: shortLabel(entry.month),
    label: longLabel(entry.month),
  }));

  const sum = (key: Serie_Key) => points.reduce((total, point) => total + (point[key] ?? 0), 0);
  const planned = sum('plannedPay');
  const hasPlanned = points.some((point) => point.plannedCount > 0);
  const hasFuture = points.some((point) => point.future);

  // As receitas primeiro, as despesas ao lado; a previsão por cima das despesas
  const series: { key: Serie_Key; name: string; color: string }[] = [
    { key: 'receive', name: t('purchasesDashboard.flow_receive'), color: '--gain' },
    { key: 'pay', name: t('purchasesDashboard.flow_pay'), color: '--loss' },
    ...(hasPlanned ? [{ key: 'plannedPay' as const, name: t('purchasesDashboard.planned'), color: '--loss' }] : []),
  ];

  const hasData = points.some((point) => point.payCount + point.receiveCount + point.plannedCount > 0);
  const summary =
    t('purchasesDashboard.summaryBoth', {
      pay: format(sum('pay')),
      receive: format(sum('receive')),
      net: format(sum('receive') - sum('pay')),
    }) + (planned > 0 ? ` · ${t('purchasesDashboard.summaryPlanned', { planned: format(planned) })}` : '');

  const filtered = (Object.keys(DEFAULT_FILTERS) as (keyof MonthlyPaymentsFilters)[]).some(
    (key) => !PERIOD_KEYS.includes(key) && filters[key] !== DEFAULT_FILTERS[key],
  );

  // A linha do "hoje", quando há meses à frente
  const todayIndex = hasFuture ? points.findIndex((point) => point.month === currentMonth()) : -1;

  const compact = (value: number) =>
    new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);

  // As receitas ao lado; as despesas e a previsão (mais clara, a tracejado nas linhas) empilhadas
  const chartSeries: Month_Chart_Series[] = series.map((serie) => ({
    id: serie.key,
    name: serie.name,
    values: points.map((point) => point[serie.key]),
    colorToken: serie.color,
    faded: serie.key === 'plannedPay',
    stack: serie.key === 'receive' ? 'receive' : 'out',
    notes: points.map((point) => t('purchasesDashboard.payments', { count: point[COUNT_OF[serie.key]] })),
  }));

  return (
    <div className="Card Monthly_Card">
      <div className="Card_Header">
        <div className="Card_Header_Text">
          <span className="Card_Title">{t('purchasesDashboard.chartTitle')}</span>
          <span className="Card_Subtitle">{summary}</span>
        </div>
        <div className="Monthly_Controls">
          <div className="Tabs">
            {(['bars', 'lines'] as Chart_Kind[]).map((option) => (
              <button
                key={option}
                type="button"
                className={kind === option ? 'Active' : ''} aria-pressed={kind === option}
                onClick={() => chooseKind(option)}
              >
                {t(`purchasesDashboard.${option}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* A zona dos filtros: o que muda as contas vai ao backend */}
      <div className="Monthly_Filters">
        <div className="Monthly_Filter">
          <span className="Eyebrow" id={`${groupId}-filterPeriod`}>{t('purchasesDashboard.filterPeriod')}</span>
          <div className="Tabs" role="group" aria-labelledby={`${groupId}-filterPeriod`}>
            {PERIODS.map((period) => (
              <button
                key={period}
                type="button"
                className={!custom && filters.months === period ? 'Active' : ''} aria-pressed={!custom && filters.months === period}
                onClick={() => {
                  setCustom(false);
                  setFilter('months', period);
                }}
              >
                {t('purchasesDashboard.months', { count: period })}
              </button>
            ))}
            <button type="button" className={custom ? 'Active' : ''} aria-pressed={custom} onClick={openCustom}>
              {t('purchasesDashboard.customDates')}
            </button>
          </div>
        </div>

        {custom ? (
          <div className="Monthly_Filter Monthly_Range">
            <label className="Eyebrow" htmlFor="payments-chart-from">{t('purchasesDashboard.filterRange')}</label>
            <div className="Monthly_Range_Fields">
              <Global_Input
                id="payments-chart-from"
                type="month"
                value={filters.from}
                onChange={(e) => setFilter('from', e.target.value)}
              />
              <span className="Monthly_Range_Sep">{t('purchasesDashboard.rangeTo')}</span>
              <Global_Input
                id="payments-chart-to"
                type="month"
                value={filters.to}
                onChange={(e) => setFilter('to', e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="Monthly_Filter">
            <span className="Eyebrow" id={`${groupId}-filterFuture`}>{t('purchasesDashboard.filterFuture')}</span>
            <div className="Tabs" role="group" aria-labelledby={`${groupId}-filterFuture`}>
              {FUTURES.map((future) => (
                <button
                  key={future}
                  type="button"
                  className={filters.future === future ? 'Active' : ''} aria-pressed={filters.future === future}
                  onClick={() => setFilter('future', future)}
                >
                  {future === 0 ? t('purchasesDashboard.noFuture') : t('purchasesDashboard.months', { count: future })}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="Monthly_Filter Wide">
          <label className="Eyebrow" htmlFor="payments-chart-supplier">{t('purchasesDashboard.filterSupplier')}</label>
          <Global_Dropdown
            id="payments-chart-supplier"
            value={filters.supplierId}
            onChange={(value) => setFilter('supplierId', String(value))}
            options={[
              { value: '', label: t('purchasesDashboard.all') },
              ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
            ]}
          />
        </div>

        <div className="Monthly_Filter Wide">
          <label className="Eyebrow" htmlFor="payments-chart-group">{t('purchasesDashboard.filterGroup')}</label>
          <Global_Dropdown
            id="payments-chart-group"
            value={filters.supplierGroupId}
            onChange={(value) => setFilter('supplierGroupId', String(value))}
            options={[
              { value: '', label: t('purchasesDashboard.all') },
              ...groups.map((group) => ({ value: group.id, label: group.name })),
            ]}
          />
        </div>

        <div className="Monthly_Filter">
          <span className="Eyebrow" id={`${groupId}-filterStatus`}>{t('purchasesDashboard.filterStatus')}</span>
          <div className="Tabs" role="group" aria-labelledby={`${groupId}-filterStatus`}>
            <button
              type="button"
              className={filters.includeDrafts ? '' : 'Active'} aria-pressed={!(filters.includeDrafts)}
              onClick={() => setFilter('includeDrafts', false)}
            >
              {t('purchasesDashboard.status_completed')}
            </button>
            <button
              type="button"
              className={filters.includeDrafts ? 'Active' : ''} aria-pressed={filters.includeDrafts}
              onClick={() => setFilter('includeDrafts', true)}
            >
              {t('purchasesDashboard.status_withDrafts')}
            </button>
          </div>
        </div>

        {filtered && (
          <button
            type="button"
            className="Monthly_Clear"
            onClick={() =>
              setFilters((current) => ({
                ...DEFAULT_FILTERS,
                months: current.months,
                future: current.future,
                from: current.from,
                to: current.to,
              }))
            }
          >
            {t('purchasesDashboard.clear')}
          </button>
        )}
      </div>

      <div className="Monthly_Body">
        {error ? (
          <span className="Monthly_Message Bad">{error}</span>
        ) : !data ? (
          <span className="Monthly_Message">{t('common.loading')}</span>
        ) : !hasData ? (
          <span className="Monthly_Message">{t('purchasesDashboard.noData')}</span>
        ) : (
          <Month_Chart
            kind={kind}
            categories={points.map((point) => point.short)}
            labels={points.map((point) => point.label)}
            series={chartSeries}
            stacked
            todayIndex={todayIndex >= 0 ? todayIndex : undefined}
            todayLabel={t('purchasesDashboard.today')}
            format={format}
            compact={compact}
          />
        )}
      </div>
    </div>
  );
};

export default Payments_Chart;
