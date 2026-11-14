import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import { useDebtSummary } from '../../../../Hooks/Finances/usePersonalDebt';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Month_Chart from '../../../../Components/Charts/Month_Chart/Month_Chart';
import { formatDay, localeOf } from '../Earnings/earningsLabels';
import { formatMonth, installmentLabel } from './debtsLabels';
import '../Earnings/Earnings.scss';
import './Debts.scss';

// Os meses para trás e a projeção para a frente que se escolhem
const PERIODS = [6, 12, 24] as const;
const FUTURES = [0, 12, 36] as const;

type Chart_Kind = 'bars' | 'lines';
const CHART_KIND_KEY = 'intristock-debts-personal-chart';

const readKind = (): Chart_Kind => {
  try {
    return localStorage.getItem(CHART_KIND_KEY) === 'bars' ? 'bars' : 'lines';
  } catch {
    return 'lines';
  }
};


/**
 * O dashboard das dívidas: os cartões (o total em dívida, as prestações por
 * mês, os juros do ano e o que está por pagar), o saldo mês a mês com a
 * projeção a pagar a prestação, por tipo, cada dívida com o que já se pagou e
 * as próximas prestações. Tudo numa moeda, contado no backend.
 */
const Debts_Dashboard = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { currencies, selectedCurrency } = useCurrency();
  const { formatIn } = useCurrencyFormat();
  const locale = localeOf(i18n.language);
  const [months, setMonths] = useState<number>(12);
  const [future, setFuture] = useState<number>(12);
  const [kind, setKind] = useState<Chart_Kind>(readKind);
  // As datas à mão (meses): o gráfico segue-as, no lugar do período e da projeção; os cartões não
  const [custom, setCustom] = useState(false);
  const [range, setRange] = useState({ from: '', to: '' });
  // A moeda é a escolhida no topo, para o site todo
  const currencyId = currencies.find((currency) => currency.shortCode === selectedCurrency)?.id ?? '';
  const validRange = custom && range.from && range.to && range.from <= range.to ? range : null;
  const { data, error } = useDebtSummary(months, future, currencyId, validRange);

  // Abre as datas com o que estava à vista: os meses para trás e a projeção
  const openCustom = () => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + future, 1));
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
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthDate = (month: string) => new Date(`${month}-01T00:00:00Z`);
  const hasLent = (data?.months ?? []).some((entry) => entry.lent > 0);
  // O saldo pelos movimentos até hoje e o projetado à frente; nas linhas o mês de
  // agora está nos dois, para se tocarem, nas barras só no de agora
  const points = (data?.months ?? []).map((entry) => {
    const past = entry.month <= currentMonth;
    const ahead = kind === 'lines' ? entry.month >= currentMonth : entry.month > currentMonth;
    return {
      ...entry,
      owed: past ? entry.owed : null,
      owedAhead: ahead ? entry.owed : null,
      lent: past && hasLent ? entry.lent : null,
      lentAhead: ahead && hasLent ? entry.lent : null,
      short: `${monthDate(entry.month).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }).replace('.', '')} ${entry.month.slice(2, 4)}`,
      label: monthDate(entry.month).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    };
  });
  // A linha do «Hoje» só com meses projetados à vista
  const todayPosition = points.findIndex((point) => point.month === currentMonth);
  const todayIndex = todayPosition >= 0 && todayPosition < points.length - 1 ? todayPosition : undefined;
  const hasData = (data?.months ?? []).some((entry) => entry.owed + entry.lent > 0);
  const kindMax = Math.max(...(data?.byKind ?? []).map((item) => item.total), 1);
  const cards = data?.cards;

  const compact = (value: number) => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  return (
    <div className="Earnings">
      <div className="Page_Head">
        <h1>{t('menu.debts')}</h1>
      </div>
      {error && <span className="Earnings_Message Bad">{error}</span>}

      <div className="Grid Auto_190">
        <div className="Card Tile Wave_Tile Down Big">
          <span className="Eyebrow">{t('debts.cardOwed')}</span>
          <span className="Tile_Value">{cards ? format(cards.owed) : '—'}</span>
          <div className="Tile_Foot">{cards ? t('debts.cardActive', { count: cards.activeCount }) : ''}</div>
        </div>
        <div className="Card Tile Wave_Tile Accent">
          <span className="Eyebrow">{t('debts.cardInstallments')}</span>
          <span className="Tile_Value">{cards ? format(cards.monthlyInstallments) : '—'}</span>
          <div className="Tile_Foot">{cards ? t('debts.cardPaidThisMonth', { amount: format(cards.paidThisMonth) }) : ''}</div>
        </div>
        <div className="Card Tile Wave_Tile Gold">
          <span className="Eyebrow">{t('debts.cardInterest')}</span>
          <span className="Tile_Value">{cards ? format(cards.interestYear) : '—'}</span>
          <div className="Tile_Foot">{cards ? t('debts.cardPaidYear', { amount: format(cards.paidYear) }) : ''}</div>
        </div>
        <div className={`Card Tile Wave_Tile ${cards && cards.overdueCount > 0 ? 'Warn' : ''}`}>
          <span className="Eyebrow">{t('debts.cardDue')}</span>
          <span className="Tile_Value">{cards ? format(cards.dueTotal) : '—'}</span>
          <div className="Tile_Foot">
            {cards
              ? t('debts.cardDueFoot', { count: cards.dueCount }) +
                (cards.overdueCount > 0 ? ` · ${t('earnings.cardOverdue', { count: cards.overdueCount })}` : '')
              : ''}
          </div>
        </div>
        {cards && cards.lent > 0 && (
          <div className="Card Tile Wave_Tile Up">
            <span className="Eyebrow">{t('debts.cardLent')}</span>
            <span className="Tile_Value">{format(cards.lent)}</span>
            <div className="Tile_Foot">{t('debts.cardLentFoot')}</div>
          </div>
        )}
      </div>

      {/* Os filtros do gráfico e o registo, num cartão esticado por cima dele */}
      <div className="Card Earnings_Toolbar">
        <div className="Earnings_Filter Inline">
          <span className="Eyebrow">{t('purchasesDashboard.filterPeriod')}</span>
          <div className="Tabs">
            {PERIODS.map((period) => (
              <button
                key={period}
                type="button"
                className={!custom && months === period ? 'Active' : ''}
                onClick={() => {
                  setCustom(false);
                  setMonths(period);
                }}
              >
                {t('purchasesDashboard.months', { count: period })}
              </button>
            ))}
            <button type="button" className={custom ? 'Active' : ''} onClick={openCustom}>
              {t('purchasesDashboard.customDates')}
            </button>
          </div>
        </div>
        {custom ? (
          <div className="Earnings_Filter Inline">
            <span className="Eyebrow">{t('purchasesDashboard.filterRange')}</span>
            <div className="Earnings_Range">
              <Global_Input
                id="debts-chart-from"
                type="month"
                value={range.from}
                onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))}
              />
              <span className="Earnings_Range_Sep">{t('purchasesDashboard.rangeTo')}</span>
              <Global_Input
                id="debts-chart-to"
                type="month"
                value={range.to}
                onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
              />
            </div>
          </div>
        ) : (
          <div className="Earnings_Filter Inline">
            <span className="Eyebrow">{t('debts.filterProjection')}</span>
            <div className="Tabs">
              {FUTURES.map((option) => (
                <button key={option} type="button" className={future === option ? 'Active' : ''} onClick={() => setFuture(option)}>
                  {option === 0 ? t('purchasesDashboard.noFuture') : t('purchasesDashboard.months', { count: option })}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="Earnings_Register">
          <Simple_Button text={t('debts.registerLink')} onClick={() => navigate('/Finances/dividas/registo')} />
        </div>
      </div>

      <div className="Card Earnings_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('debts.chartTitle')}</span>
            <span className="Card_Subtitle">
              {cards?.nextPayoff
                ? t('debts.chartSubtitleEnd', {
                    currency: code,
                    name: cards.nextPayoff.name,
                    month: formatMonth(cards.nextPayoff.month, locale),
                  })
                : t('debts.chartSubtitle', { currency: code })}
              {data?.estimatedRates ? t('finances.ratesEstimated', { count: data.estimatedRates }) : ''}
            </span>
          </div>
          <div className="Earnings_Controls">
            <div className="Tabs">
              {(['bars', 'lines'] as Chart_Kind[]).map((option) => (
                <button key={option} type="button" className={kind === option ? 'Active' : ''} onClick={() => chooseKind(option)}>
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
            <span className="Earnings_Message">{t('debts.noData')}</span>
          ) : (
            <Month_Chart
              kind={kind}
              categories={points.map((point) => point.short)}
              labels={points.map((point) => point.label)}
              series={[
                { id: 'owed', name: t('debts.seriesOwed'), values: points.map((point) => point.owed), colorToken: '--loss' },
                {
                  id: 'owedAhead',
                  name: `${t('debts.seriesOwed')} · ${t('debts.projected')}`,
                  values: points.map((point) => point.owedAhead),
                  colorToken: '--loss',
                  faded: true,
                },
                ...(hasLent
                  ? [
                      { id: 'lent', name: t('debts.seriesLent'), values: points.map((point) => point.lent), colorToken: '--accent' },
                      {
                        id: 'lentAhead',
                        name: `${t('debts.seriesLent')} · ${t('debts.projected')}`,
                        values: points.map((point) => point.lentAhead),
                        colorToken: '--accent',
                        faded: true,
                      },
                    ]
                  : []),
              ]}
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
              <span className="Card_Title">{t('debts.byKindTitle')}</span>
            </div>
          </div>
          <div className="Earnings_Body">
            {!data || data.byKind.length === 0 ? (
              <span className="Earnings_Message">{t('debts.noData')}</span>
            ) : (
              <div className="Earnings_Shares">
                {data.byKind.map((item) => (
                  <div key={item.kind} className="Earnings_Share">
                    <div className="Earnings_Share_Head">
                      <span>{t(`debts.kind_${item.kind}`)}</span>
                      <span className="Num">{format(item.total)}</span>
                    </div>
                    <div className="Earnings_Share_Track">
                      <div className="Earnings_Share_Fill Debt_Fill_Owed" style={{ width: `${(item.total / kindMax) * 100}%` }} />
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
              <span className="Card_Title">{t('debts.eachTitle')}</span>
              <span className="Card_Subtitle">{t('debts.eachSubtitle')}</span>
            </div>
          </div>
          <div className="Earnings_Body">
            {!data || data.debts.length === 0 ? (
              <span className="Earnings_Message">{t('debts.noData')}</span>
            ) : (
              <div className="Debt_Rows">
                {data.debts.map((debt) => (
                  <div key={debt.id}>
                    <div className="Debt_Row_Head">
                      <span>
                        <span className="Earnings_Strong">{debt.name}</span>
                        <span className="Earnings_Sub">
                          {' · '}
                          {debt.projectedEnd
                            ? t('debts.endsIn', { month: formatMonth(debt.projectedEnd, locale) })
                            : t(`debts.kind_${debt.kind}`)}
                        </span>
                      </span>
                      <span className="Num">{formatIn(debt.balance, debt.currency.shortCode)}</span>
                    </div>
                    <div className="Earnings_Share_Track">
                      <div
                        className={`Earnings_Share_Fill${debt.direction === 'lent' ? ' Accent' : ''}`}
                        style={{ width: `${debt.paidPct}%` }}
                      />
                    </div>
                    <span className="Earnings_Sub">{t('debts.paidPct', { pct: Math.round(debt.paidPct) })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="Card Earnings_Card">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('debts.upcomingTitle')}</span>
            </div>
            <div className="Earnings_Controls">
              <button type="button" className="Earnings_Link" onClick={() => navigate('/Finances/dividas/registo')}>
                {t('common.seeAll')}
              </button>
            </div>
          </div>
          <div className="Earnings_Body">
            {!data || data.upcoming.length === 0 ? (
              <span className="Earnings_Message">{t('debts.dueEmpty')}</span>
            ) : (
              <div className="Earnings_Upcoming">
                {data.upcoming.map((item) => (
                  <div key={`${item.debtId}|${item.period}`} className="Earnings_Upcoming_Row">
                    <div className="Earnings_Upcoming_Text">
                      <span className="Earnings_Strong">{item.name}</span>
                      <span className="Earnings_Sub">
                        {formatDay(item.date, locale)} · {installmentLabel(t, locale, item.period, item.direction)}
                      </span>
                    </div>
                    <div className="Earnings_Upcoming_Value">
                      <span className="Num">{formatIn(item.amount, item.currency.shortCode)}</span>
                      {item.overdue && <span className="Pill Bad">{t('earnings.overdue')}</span>}
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

export default Debts_Dashboard;
