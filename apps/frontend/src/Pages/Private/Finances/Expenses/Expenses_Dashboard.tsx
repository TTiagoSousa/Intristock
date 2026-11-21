import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import { useExpenseSummary, type Item_Category_Total } from '../../../../Hooks/Finances/usePersonalExpense';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Month_Chart from '../../../../Components/Charts/Month_Chart/Month_Chart';
import { localeOf } from '../Earnings/earningsLabels';
import '../Earnings/Earnings.scss';
import './Expenses.scss';
import { localMonth } from '../../../../utils/dates';

const PERIODS = [6, 12, 24] as const;
type Chart_Kind = 'bars' | 'lines';
const CHART_KIND_KEY = 'intristock-expenses-personal-chart';

const readKind = (): Chart_Kind => {
  try {
    return localStorage.getItem(CHART_KIND_KEY) === 'lines' ? 'lines' : 'bars';
  } catch {
    return 'bars';
  }
};

/**
 * O dashboard das despesas: os cartões (este mês, o anterior, o ano, a média e
 * as por pagar), o total de cada mês (barras ou linhas), por categoria com as
 * subcategorias, as lojas e os produtos em que mais se gasta. Tudo numa moeda,
 * contado no backend.
 */
const Expenses_Dashboard = () => {
  const { t, i18n } = useTranslation();
  const groupId = useId();
  const navigate = useNavigate();
  const { currencies, selectedCurrency } = useCurrency();
  const { formatIn } = useCurrencyFormat();
  const locale = localeOf(i18n.language);
  const [months, setMonths] = useState<number>(12);
  const [kind, setKind] = useState<Chart_Kind>(readKind);
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set());
  // As datas à mão (meses): o gráfico e as somas seguem-nas, os cartões não
  const [custom, setCustom] = useState(false);
  const [range, setRange] = useState({ from: '', to: '' });
  // A moeda é a escolhida no topo, para o site todo
  const currencyId = currencies.find((currency) => currency.shortCode === selectedCurrency)?.id ?? '';
  const validRange = custom && range.from && range.to && range.from <= range.to ? range : null;
  const { data, error } = useExpenseSummary(months, currencyId, validRange);

  // Abre as datas com o período que estava à vista
  const openCustom = () => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - (months - 1), 1));
    setRange((current) => ({
      from: current.from || start.toISOString().slice(0, 7),
      to: current.to || localMonth(now),
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
  const points = (data?.months ?? []).map((entry) => ({
    ...entry,
    pending: entry.pending || null,
    short: `${monthDate(entry.month).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }).replace('.', '')} ${entry.month.slice(2, 4)}`,
    label: monthDate(entry.month).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  }));
  // A linha do «Hoje» só quando há meses à frente à vista (as datas à mão)
  const todayPosition = points.findIndex((point) => point.month === localMonth());
  const todayIndex = todayPosition >= 0 && todayPosition < points.length - 1 ? todayPosition : undefined;
  const hasData = points.some((point) => point.paid + (point.pending ?? 0) > 0);
  const merchantMax = Math.max(...(data?.merchants ?? []).map((item) => item.total), 1);

  // Por categoria e por item: cada uma abre as de dentro, a qualquer profundidade
  const toggleItem = (id: string) =>
    setOpenItems((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const renderItems = (items: Item_Category_Total[], max: number): React.ReactNode =>
    items.map((item) => (
      <div key={item.id ?? 'none'} className="Earnings_Share">
        <button
          type="button"
          className="Earnings_Share_Head Expense_Share_Button"
          onClick={() => item.id && item.children.length > 0 && toggleItem(item.id)}
        >
          <span>
            {item.name ?? t('expenses.noCategory')}
            {item.children.length > 0 && <span className="Earnings_Sub"> {item.id && openItems.has(item.id) ? '▾' : '▸'}</span>}
          </span>
          <span className="Num">{format(item.total)}</span>
        </button>
        <div className="Earnings_Share_Track">
          <div className="Earnings_Share_Fill Loss" style={{ width: `${(item.total / max) * 100}%` }} />
        </div>
        {item.id && openItems.has(item.id) && <div className="Expense_Tree_Children">{renderItems(item.children, max)}</div>}
      </div>
    ));

  const compact = (value: number) => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);

  return (
    <div className="Earnings">
      <div className="Page_Head">
        <h1>{t('menu.expenses')}</h1>
      </div>
      {error && <span className="Earnings_Message Bad">{error}</span>}

      <div className="Grid Auto_190">
        <div className="Card Tile Wave_Tile Down Big">
          <span className="Eyebrow">{t('expenses.cardThisMonth')}</span>
          <span className="Tile_Value">{data ? format(data.cards.thisMonth) : '—'}</span>
          <div className="Tile_Foot">{data ? t('expenses.cardLastMonth', { amount: format(data.cards.lastMonth) }) : ''}</div>
        </div>
        <div className="Card Tile Wave_Tile Accent">
          <span className="Eyebrow">{t('expenses.cardYear')}</span>
          <span className="Tile_Value">{data ? format(data.cards.year) : '—'}</span>
        </div>
        <div className="Card Tile Wave_Tile">
          <span className="Eyebrow">{t('expenses.cardAverage', { count: months })}</span>
          <span className="Tile_Value">{data ? format(data.cards.monthlyAverage) : '—'}</span>
        </div>
        <div className="Card Tile Wave_Tile Warn">
          <span className="Eyebrow">{t('expenses.cardPending')}</span>
          <span className="Tile_Value">{data ? format(data.cards.pending) : '—'}</span>
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
        {custom && (
          <div className="Earnings_Filter Inline">
            <label className="Eyebrow" htmlFor="expenses-chart-from">{t('purchasesDashboard.filterRange')}</label>
            <div className="Earnings_Range">
              <Global_Input
                id="expenses-chart-from"
                type="month"
                value={range.from}
                onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))}
              />
              <span className="Earnings_Range_Sep">{t('purchasesDashboard.rangeTo')}</span>
              <Global_Input
                id="expenses-chart-to"
                type="month"
                value={range.to}
                onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
              />
            </div>
          </div>
        )}
        <div className="Earnings_Register">
          <Simple_Button text={t('expenses.registerLink')} onClick={() => navigate('/Finances/despesas/registo')} />
        </div>
      </div>

      <div className="Card Earnings_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('expenses.chartTitle')}</span>
            <span className="Card_Subtitle">
              {t('expenses.chartSubtitle', { currency: code })}
              {data?.estimatedRates ? t('finances.ratesEstimated', { count: data.estimatedRates }) : ''}
            </span>
          </div>
          <div className="Earnings_Controls">
            <div className="Tabs">
              {(['bars', 'lines'] as Chart_Kind[]).map((option) => (
                <button key={option} type="button" className={kind === option ? 'Active' : ''} aria-pressed={kind === option} onClick={() => chooseKind(option)}>
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
            <span className="Earnings_Message">{t('expenses.noData')}</span>
          ) : (
            <Month_Chart
              kind={kind}
              categories={points.map((point) => point.short)}
              labels={points.map((point) => point.label)}
              series={[
                { id: 'paid', name: t('expenses.status_paid'), values: points.map((point) => point.paid), colorToken: '--loss' },
                {
                  id: 'pending',
                  name: t('expenses.status_pending'),
                  values: points.map((point) => point.pending),
                  colorToken: '--loss',
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
              <span className="Card_Title">{t('expenses.byCategoryTitle')}</span>
              <span className="Card_Subtitle">{t('expenses.byCategoryHint')}</span>
            </div>
          </div>
          <div className="Earnings_Body">
            {!data || data.byCategory.length === 0 ? (
              <span className="Earnings_Message">{t('expenses.noData')}</span>
            ) : (
              <div className="Earnings_Shares">
                {renderItems(data.byCategory, Math.max(...data.byCategory.map((item) => item.total), 1))}
              </div>
            )}
          </div>
        </div>

        <div className="Card Earnings_Card">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('expenses.byItemTitle')}</span>
              <span className="Card_Subtitle">{t('expenses.byItemHint')}</span>
            </div>
          </div>
          <div className="Earnings_Body">
            {!data || data.byItem.length === 0 ? (
              <span className="Earnings_Message">{t('expenses.noProducts')}</span>
            ) : (
              <div className="Earnings_Shares">{renderItems(data.byItem, Math.max(...data.byItem.map((item) => item.total), 1))}</div>
            )}
          </div>
        </div>

        <div className="Card Earnings_Card">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('expenses.merchantsTitle')}</span>
            </div>
          </div>
          <div className="Earnings_Body">
            {!data || data.merchants.length === 0 ? (
              <span className="Earnings_Message">{t('expenses.noData')}</span>
            ) : (
              <div className="Earnings_Shares">
                {data.merchants.map((item) => (
                  <div key={item.name} className="Earnings_Share">
                    <div className="Earnings_Share_Head">
                      <span>
                        {item.name}
                        <span className="Earnings_Sub"> · {t('expenses.visits', { count: item.count })}</span>
                      </span>
                      <span className="Num">{format(item.total)}</span>
                    </div>
                    <div className="Earnings_Share_Track">
                      <div className="Earnings_Share_Fill Accent" style={{ width: `${(item.total / merchantMax) * 100}%` }} />
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
              <span className="Card_Title">{t('expenses.productsTitle')}</span>
            </div>
          </div>
          <div className="Earnings_Body">
            {!data || data.products.length === 0 ? (
              <span className="Earnings_Message">{t('expenses.noProducts')}</span>
            ) : (
              <div className="Earnings_Upcoming">
                {data.products.map((item) => (
                  <div key={item.id} className="Earnings_Upcoming_Row">
                    <div className="Earnings_Upcoming_Text">
                      <span className="Earnings_Strong">{item.name}</span>
                      <span className="Earnings_Sub">
                        {t('expenses.productStats', { quantity: item.quantity, count: item.count, price: format(item.lastPrice) })}
                      </span>
                    </div>
                    <div className="Earnings_Upcoming_Value">
                      <span className="Num">{format(item.total)}</span>
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

export default Expenses_Dashboard;
