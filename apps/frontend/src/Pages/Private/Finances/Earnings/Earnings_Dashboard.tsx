import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import { useIncomeSummary } from '../../../../Hooks/Finances/usePersonalIncome';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Month_Chart from '../../../../Components/Charts/Month_Chart/Month_Chart';
import { expectedPartLabel, formatDay, localeOf } from './earningsLabels';
import './Earnings.scss';
import { localMonth } from '../../../../utils/dates';

// Os períodos (meses para trás) e os meses à frente que se escolhem
const PERIODS = [6, 12, 24] as const;
const FUTURES = [0, 3, 6] as const;

type Chart_Kind = 'bars' | 'lines';
const CHART_KIND_KEY = 'intristock-earnings-chart';

const readKind = (): Chart_Kind => {
  try {
    return localStorage.getItem(CHART_KIND_KEY) === 'lines' ? 'lines' : 'bars';
  } catch {
    return 'bars';
  }
};

interface Point {
  month: string;
  short: string;
  label: string;
  // Vazio (null) onde a linha não deve passar: o recebido nos meses futuros e o
  // por receber nos meses passados sem nada
  received: number | null;
  pending: number | null;
  future: boolean;
}

/**
 * O dashboard dos ganhos: os cartões (recebido no período, no ano, a média por
 * mês e o que falta receber), o recebido e o por receber de cada mês, por tipo,
 * por fonte e os próximos a receber. Tudo numa moeda, contado no backend.
 */
const Earnings_Dashboard = () => {
  const { t, i18n } = useTranslation();
  const groupId = useId();
  const navigate = useNavigate();
  const { currencies, selectedCurrency } = useCurrency();
  const { formatIn } = useCurrencyFormat();
  const locale = localeOf(i18n.language);
  const [months, setMonths] = useState<number>(12);
  const [future, setFuture] = useState<number>(3);
  const [kind, setKind] = useState<Chart_Kind>(readKind);
  // As datas à mão (meses): só o gráfico e as somas por tipo e por fonte as seguem
  const [custom, setCustom] = useState(false);
  const [range, setRange] = useState({ from: '', to: '' });
  // A moeda é a escolhida no topo, para o site todo
  const currencyId = currencies.find((currency) => currency.shortCode === selectedCurrency)?.id ?? '';
  const validRange = custom && range.from && range.to && range.from <= range.to ? range : null;
  const { data, error } = useIncomeSummary(months, future, currencyId, validRange);

  // Abre as datas com o período que estava à vista
  const openCustom = () => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - (months - 1), 1));
    const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + future, 1));
    setRange((current) => ({
      from: current.from || start.toISOString().slice(0, 7),
      to: current.to || end.toISOString().slice(0, 7),
    }));
    setCustom(true);
  };

  const chooseKind = (next: Chart_Kind) => {
    setKind(next);
    try {
      localStorage.setItem(CHART_KIND_KEY, next);
    } catch {
      // Sem armazenamento fica só nesta visita
    }
  };

  const code = data?.currency?.shortCode ?? selectedCurrency;
  const format = (value: number) => formatIn(value, code);
  const monthDate = (month: string) => new Date(`${month}-01T00:00:00Z`);
  const points: Point[] = (data?.months ?? []).map((entry) => ({
    ...entry,
    received: entry.future && entry.received === 0 ? null : entry.received,
    pending: !entry.future && entry.pending === 0 ? null : entry.pending,
    short: `${monthDate(entry.month).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }).replace('.', '')} ${entry.month.slice(2, 4)}`,
    label: monthDate(entry.month).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  }));
  // O mês de hoje no browser (não em UTC)
  const currentMonth = localMonth();
  // A linha do «Hoje» só quando há meses à frente à vista
  const todayPosition = points.findIndex((point) => point.month === currentMonth);
  const todayIndex = todayPosition >= 0 && todayPosition < points.length - 1 ? todayPosition : undefined;
  const hasData = points.some((point) => (point.received ?? 0) + (point.pending ?? 0) > 0);
  const kindMax = Math.max(...(data?.byKind ?? []).map((item) => item.total), 1);
  const sourceMax = Math.max(...(data?.bySource ?? []).map((item) => item.total), 1);
  // Por baixo dos cartões: o que ainda falta receber este ano e o melhor mês
  const yearPending = (data?.months ?? [])
    .filter((entry) => entry.month.startsWith(currentMonth.slice(0, 4)))
    .reduce((sum, entry) => sum + entry.pending, 0);
  const bestMonth = points
    .filter((point) => !point.future && (point.received ?? 0) > 0)
    .reduce<Point | null>((best, point) => (!best || (point.received ?? 0) > (best.received ?? 0) ? point : best), null);

  const compact = (value: number) =>
    new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);

  return (
    <div className="Earnings">
      <div className="Page_Head">
        <h1>{t('menu.earnings')}</h1>
      </div>
      {error && <span className="Earnings_Message Bad">{error}</span>}

      <div className="Grid Auto_190">
        <div className="Card Tile Wave_Tile Up Big">
          <span className="Eyebrow">{t('earnings.cardReceived', { count: months })}</span>
          <span className="Tile_Value">{data ? format(data.cards.received) : '—'}</span>
          <div className="Tile_Foot">
            {data ? t('earnings.cardThisMonth', { amount: format(data.cards.receivedThisMonth) }) : ''}
          </div>
        </div>
        <div className="Card Tile Wave_Tile Accent">
          <span className="Eyebrow">{t('earnings.cardYear')}</span>
          <span className="Tile_Value">{data ? format(data.cards.receivedYear) : '—'}</span>
          <div className="Tile_Foot">{data ? t('earnings.cardYearPending', { amount: format(yearPending) }) : ''}</div>
        </div>
        <div className="Card Tile Wave_Tile">
          <span className="Eyebrow">{t('earnings.cardAverage')}</span>
          <span className="Tile_Value">{data ? format(data.cards.monthlyAverage) : '—'}</span>
          <div className="Tile_Foot">
            {bestMonth ? t('earnings.cardBestMonth', { month: bestMonth.short, amount: format(bestMonth.received ?? 0) }) : ''}
          </div>
        </div>
        <div className={`Card Tile Wave_Tile ${data && data.cards.overdueCount > 0 ? 'Warn' : 'Gold'}`}>
          <span className="Eyebrow">{t('earnings.cardPending')}</span>
          <span className="Tile_Value">{data ? format(data.cards.pending) : '—'}</span>
          <div className="Tile_Foot">
            {data
              ? t('earnings.cardPendingFoot', { count: data.cards.pendingCount }) +
                (data.cards.overdueCount > 0
                  ? ` · ${t('earnings.cardOverdue', { count: data.cards.overdueCount })}`
                  : '')
              : ''}
          </div>
        </div>
      </div>

      {/* Os filtros do gráfico e o registo, num cartão esticado por cima dele */}
      <div className="Card Earnings_Toolbar">
        <div className="Earnings_Filter Inline">
          <span className="Eyebrow" id={`${groupId}-filterPeriod`}>{t('purchasesDashboard.filterPeriod')}</span>
          <div className="Tabs" role="group" aria-labelledby={`${groupId}-filterPeriod`}>
            {PERIODS.map((period) => (
              <button
                key={period}
                type="button"
                className={!custom && months === period ? 'Active' : ''} aria-pressed={!custom && months === period}
                onClick={() => {
                  setCustom(false);
                  setMonths(period);
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
          <div className="Earnings_Filter Inline">
            <label className="Eyebrow" htmlFor="earnings-chart-from">{t('purchasesDashboard.filterRange')}</label>
            <div className="Earnings_Range">
              <Global_Input
                id="earnings-chart-from"
                type="month"
                value={range.from}
                onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))}
              />
              <span className="Earnings_Range_Sep">{t('purchasesDashboard.rangeTo')}</span>
              <Global_Input
                id="earnings-chart-to"
                type="month"
                value={range.to}
                onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
              />
            </div>
          </div>
        ) : (
          <div className="Earnings_Filter Inline">
            <span className="Eyebrow" id={`${groupId}-filterFuture`}>{t('purchasesDashboard.filterFuture')}</span>
            <div className="Tabs" role="group" aria-labelledby={`${groupId}-filterFuture`}>
              {FUTURES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={future === option ? 'Active' : ''} aria-pressed={future === option}
                  onClick={() => setFuture(option)}
                >
                  {option === 0 ? t('purchasesDashboard.noFuture') : t('purchasesDashboard.months', { count: option })}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="Earnings_Register">
          <Simple_Button text={t('earnings.registerLink')} onClick={() => navigate('/Finances/ganhos/registo')} />
        </div>
      </div>

      <div className="Card Earnings_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('earnings.chartTitle')}</span>
            <span className="Card_Subtitle">
              {t('earnings.chartSubtitle', { currency: code })}
              {data?.estimatedRates ? t('finances.ratesEstimated', { count: data.estimatedRates }) : ''}
            </span>
          </div>
          <div className="Earnings_Controls">
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
        <div className="Earnings_Chart">
          {!data ? (
            <span className="Earnings_Message">{t('common.loading')}</span>
          ) : !hasData ? (
            <span className="Earnings_Message">{t('earnings.noData')}</span>
          ) : (
            <Month_Chart
              kind={kind}
              categories={points.map((point) => point.short)}
              labels={points.map((point) => point.label)}
              series={[
                { id: 'received', name: t('earnings.status_received'), values: points.map((point) => point.received), colorToken: '--gain' },
                {
                  id: 'pending',
                  name: t('earnings.status_pending'),
                  values: points.map((point) => point.pending),
                  colorToken: '--gain',
                  faded: true,
                },
              ]}
              stacked
              todayIndex={todayIndex}
              todayLabel={t('purchasesDashboard.today')}
              format={format}
              compact={compact}
            />
          )}
        </div>
      </div>

      <div className="Earnings_Panels">
        <div className="Card Earnings_Card">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('earnings.byKindTitle')}</span>
            </div>
          </div>
          <div className="Earnings_Body">
            {!data || data.byKind.length === 0 ? (
              <span className="Earnings_Message">{t('earnings.noData')}</span>
            ) : (
              <div className="Earnings_Shares">
                {data.byKind.map((item) => (
                  <div key={item.kind} className="Earnings_Share">
                    <div className="Earnings_Share_Head">
                      <span>{t(`earnings.kind_${item.kind}`)}</span>
                      <span className="Num">{format(item.total)}</span>
                    </div>
                    <div className="Earnings_Share_Track">
                      <div className="Earnings_Share_Fill" style={{ width: `${(item.total / kindMax) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="Card Earnings_Card">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('earnings.bySourceTitle')}</span>
            </div>
          </div>
          <div className="Earnings_Body">
            {!data || data.bySource.length === 0 ? (
              <span className="Earnings_Message">{t('earnings.noData')}</span>
            ) : (
              <div className="Earnings_Shares">
                {data.bySource.map((item) => (
                  <div key={item.key} className="Earnings_Share">
                    <div className="Earnings_Share_Head">
                      <span>
                        {item.name ?? t('earnings.noSource')}
                        <span className="Earnings_Sub"> · {t('earnings.incomes', { count: item.count })}</span>
                      </span>
                      <span className="Num">{format(item.total)}</span>
                    </div>
                    <div className="Earnings_Share_Track">
                      <div className="Earnings_Share_Fill Accent" style={{ width: `${(item.total / sourceMax) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="Card Earnings_Card">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('earnings.upcomingTitle')}</span>
            </div>
            <div className="Earnings_Controls">
              <button type="button" className="Earnings_Link" onClick={() => navigate('/Finances/ganhos/registo')}>
                {t('common.seeAll')}
              </button>
            </div>
          </div>
          <div className="Earnings_Body">
            {!data || data.upcoming.length === 0 ? (
              <span className="Earnings_Message">{t('earnings.upcomingEmpty')}</span>
            ) : (
              <div className="Earnings_Upcoming">
                {data.upcoming.map((item) => (
                  <div key={`${item.origin}|${item.part ?? ''}|${item.id ?? item.name}|${item.period}|${item.date}`} className="Earnings_Upcoming_Row">
                    <div className="Earnings_Upcoming_Text">
                      <span className="Earnings_Strong">{item.name ?? t(`earnings.kind_${item.kind}`)}</span>
                      <span className="Earnings_Sub">
                        {formatDay(item.date, locale)}
                        {item.part ? ` · ${expectedPartLabel(t, locale, item.part, item.period)}` : ''}
                      </span>
                    </div>
                    <div className="Earnings_Upcoming_Value">
                      <span className="Num">{formatIn(item.amount, item.currency.shortCode)}</span>
                      {item.overdue && <span className="Pill Bad">{t('earnings.overdue')}</span>}
                      {item.companyPaid && <span className="Pill Info">{t('earnings.toConfirm')}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Earnings_Dashboard;
