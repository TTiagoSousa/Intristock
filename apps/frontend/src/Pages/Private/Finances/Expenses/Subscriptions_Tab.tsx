import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../../Contexts/Alert_Context';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import {
  SUBSCRIPTION_KINDS,
  SUBSCRIPTION_STATUSES,
  useSubscriptions,
  type Personal_Subscription,
  type Subscription_Period,
} from '../../../../Hooks/Finances/usePersonalExpense';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import { usePagedList } from '../../../../Hooks/usePagedList';
import * as Icon from '../../../../Imports/icons';
import Confirm_Popover from '../../Companies/Company_Members/Confirm_Popover';
import { formatDay, localeOf } from '../Earnings/earningsLabels';
import Subscription_Popover from './Subscription_Popover';

// Até onde se veem os pagamentos à frente (meses)
const AHEAD = [3, 6, 12, 24] as const;
type Period_View = 'due' | 'paid' | 'all';
const PERIOD_VIEWS: Period_View[] = ['due', 'paid', 'all'];

const STATUS_PILL: Record<string, string> = { active: 'Ok', paused: 'Warn', cancelled: '' };

/**
 * As subscrições (Netflix, Game Pass, um passe de jogo): os totais por mês e
 * por ano, a lista com o próximo pagamento de cada uma e os pagamentos, dos 3
 * meses para trás aos escolhidos à frente. Cada pagamento marca-se como pago à
 * mão, também os que ainda não chegaram, e grava uma despesa.
 */
const Subscriptions_Tab = () => {
  const { t, i18n } = useTranslation();
  const { setAlert } = useAlert();
  const { currencies, selectedCurrency } = useCurrency();
  const { formatIn } = useCurrencyFormat();
  const locale = localeOf(i18n.language);
  const [ahead, setAhead] = useState<number>(12);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState<Period_View>('due');
  const [editing, setEditing] = useState<{ subscription: Personal_Subscription | null } | null>(null);
  const [deleting, setDeleting] = useState<Personal_Subscription | null>(null);
  // A moeda é a escolhida no topo, para o site todo
  const currencyId = currencies.find((currency) => currency.shortCode === selectedCurrency)?.id ?? '';
  const state = useSubscriptions(ahead, currencyId);
  const code = state.data?.currency?.shortCode ?? selectedCurrency;

  const close = () => {
    setEditing(null);
    setDeleting(null);
    state.clearActionError();
  };

  const term = q.trim().toLowerCase();
  const matches = (subscription: Personal_Subscription) =>
    (!term || `${subscription.name} ${subscription.merchant ?? ''}`.toLowerCase().includes(term)) && (!kind || subscription.kind === kind);
  const all = state.data?.subscriptions ?? [];
  const subscriptions = all.filter((subscription) => matches(subscription) && (!status || subscription.status === status));
  const byId = new Map(all.map((subscription) => [subscription.id, subscription]));
  const periods = (state.data?.periods ?? []).filter((period) => {
    const subscription = byId.get(period.subscriptionId);
    if (!subscription || !matches(subscription)) return false;
    return view === 'all' || (view === 'paid' ? period.paid : !period.paid);
  });
  // A tabela às páginas de 10 linhas
  const subscriptionsPage = usePagedList(subscriptions, 10);
  const periodsPage = usePagedList(periods, 10);

  // "9,99 € por mês", "59,99 € por ano", "29,99 € uma vez"
  const priceLabel = (subscription: Personal_Subscription) => {
    const price = formatIn(subscription.amount, subscription.currency.shortCode);
    if (!subscription.recurring) return t('subscriptions.priceOnce', { price });
    const every = subscription.intervalMonths;
    return [1, 3, 6, 12].includes(every)
      ? t(`subscriptions.price_${every}`, { price })
      : t('subscriptions.priceEvery', { price, count: every });
  };

  // O mês que paga ("novembro de 2026"), ou "Pagamento único"
  const periodLabel = (period: Subscription_Period) =>
    period.period === 'once'
      ? t('subscriptions.periodOnce')
      : new Date(`${period.period}-01T00:00:00Z`).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const togglePaid = async (period: Subscription_Period) => {
    const done = period.paid
      ? await state.unpay(period.subscriptionId, period.period)
      : await state.pay(period.subscriptionId, period.period);
    if (!done) setAlert({ open: true, message: t('subscriptions.payFailed'), type: 'error' });
  };

  const totals = state.data?.totals;

  return (
    <>
      <div className="Grid Auto_190">
        <div className="Card Tile Wave_Tile Down Big">
          <span className="Eyebrow">{t('subscriptions.cardMonthly')}</span>
          <span className="Tile_Value">{totals ? formatIn(totals.monthly, code) : '—'}</span>
          <div className="Tile_Foot">{t('subscriptions.cardMonthlyFoot')}</div>
        </div>
        <div className="Card Tile Wave_Tile Accent">
          <span className="Eyebrow">{t('subscriptions.cardYearly')}</span>
          <span className="Tile_Value">{totals ? formatIn(totals.yearly, code) : '—'}</span>
          <div className="Tile_Foot">{t('subscriptions.cardYearlyFoot')}</div>
        </div>
        <div className="Card Tile Wave_Tile Up">
          <span className="Eyebrow">{t('subscriptions.cardActive')}</span>
          <span className="Tile_Value">{totals ? totals.active : '—'}</span>
          <div className="Tile_Foot">{totals ? t('subscriptions.cardActiveFoot', { count: all.length }) : ''}</div>
        </div>
        <div className="Card Tile Wave_Tile Gold">
          <span className="Eyebrow">{t('subscriptions.cardOverdue')}</span>
          <span className="Tile_Value">{totals ? totals.overdue : '—'}</span>
          <div className="Tile_Foot">{t('subscriptions.cardOverdueFoot')}</div>
        </div>
      </div>

      <div className="Card Earnings_Filter_Card">
        <div className="Earnings_Filters">
          <div className="Earnings_Filter Wide">
            <span className="Eyebrow">{t('expenses.search')}</span>
            <Global_Input id="subscriptions-q" value={q} onChange={(e) => setQ(e.target.value)} icon={Icon.Search} />
          </div>
          <div className="Earnings_Filter Wide">
            <span className="Eyebrow">{t('subscriptions.kind')}</span>
            <Global_Dropdown
              id="subscriptions-kind"
              value={kind}
              onChange={(value) => setKind(String(value))}
              options={['', ...SUBSCRIPTION_KINDS].map((option) => ({
                value: option,
                label: option ? t(`subscriptions.kind_${option}`) : t('earnings.all'),
              }))}
            />
          </div>
          <div className="Earnings_Filter Wide">
            <span className="Eyebrow">{t('subscriptions.status')}</span>
            <Global_Dropdown
              id="subscriptions-status"
              value={status}
              onChange={(value) => setStatus(String(value))}
              options={['', ...SUBSCRIPTION_STATUSES].map((option) => ({
                value: option,
                label: option ? t(`subscriptions.status_${option}`) : t('earnings.all'),
              }))}
            />
          </div>
          <div className="Earnings_Filter Wide">
            <span className="Eyebrow">{t('subscriptions.ahead')}</span>
            <Global_Dropdown
              id="subscriptions-ahead"
              value={ahead}
              onChange={(value) => setAhead(Number(value))}
              options={AHEAD.map((option) => ({ value: option, label: t('purchasesDashboard.months', { count: option }) }))}
            />
          </div>
        </div>
      </div>

      {state.error && <span className="Earnings_Message Bad">{state.error}</span>}

      <div className="Card Earnings_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('subscriptions.listTitle')}</span>
            <span className="Card_Subtitle">{t('subscriptions.listSubtitle')}</span>
          </div>
          <div className="Earnings_Controls">
            <Simple_Button text={t('subscriptions.addTitle')} onClick={() => setEditing({ subscription: null })} />
          </div>
        </div>
        <div className="Earnings_Body">
          {!state.data ? (
            <span className="Earnings_Message">{t('common.loading')}</span>
          ) : subscriptions.length === 0 ? (
            <div className="Empty_State">
              <span className="Empty_State_Title">{t(all.length === 0 ? 'subscriptions.empty' : 'expenses.noMatch')}</span>
              {all.length === 0 && <span className="Empty_State_Text">{t('subscriptions.emptyHint')}</span>}
            </div>
          ) : (
            <>
              <div className="Table_Wrap">
                <table className="Table">
                  <thead>
                    <tr>
                      <th>{t('subscriptions.name')}</th>
                      <th className="Right">{t('subscriptions.price')}</th>
                      <th>{t('subscriptions.next')}</th>
                      <th>{t('subscriptions.lastPaid')}</th>
                      <th className="Right">{t('subscriptions.paidTotal')}</th>
                      <th />
                      <th className="Earnings_Col_Icons" />
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptionsPage.pageItems.map((subscription) => (
                      <tr key={subscription.id} className={subscription.status === 'active' ? '' : 'Earnings_Inactive'}>
                        <td>
                          <span className="Earnings_Strong">{subscription.name}</span>
                          <div className="Earnings_Sub">
                            {[t(`subscriptions.kind_${subscription.kind}`), subscription.merchant].filter(Boolean).join(' · ')}
                          </div>
                        </td>
                        <td className="Right Num">
                          {priceLabel(subscription)}
                          {subscription.monthlyAmount !== null && subscription.intervalMonths > 1 && (
                            <div className="Earnings_Sub">
                              {t('subscriptions.perMonth', { price: formatIn(subscription.monthlyAmount, subscription.currency.shortCode) })}
                            </div>
                          )}
                        </td>
                        <td className="Num">{subscription.nextDate ? formatDay(subscription.nextDate, locale) : '—'}</td>
                        <td className="Num">{subscription.lastPaidDate ? formatDay(subscription.lastPaidDate, locale) : '—'}</td>
                        <td className="Right Num">
                          {formatIn(subscription.paidTotal, subscription.currency.shortCode)}
                          <div className="Earnings_Sub">{t('subscriptions.payments', { count: subscription.paidCount })}</div>
                        </td>
                        <td>
                          <span className={`Pill ${STATUS_PILL[subscription.status]}`}>{t(`subscriptions.status_${subscription.status}`)}</span>
                        </td>
                        <td>
                          <div className="Row_Actions">
                            <button
                              type="button"
                              className="Icon_Button Tiny"
                              title={t('common.edit')}
                              aria-label={t('common.edit')}
                              onClick={() => setEditing({ subscription })}
                            >
                              <Icon.Edit />
                            </button>
                            <button
                              type="button"
                              className="Icon_Button Tiny"
                              title={t('common.delete')}
                              aria-label={t('common.delete')}
                              onClick={() => setDeleting(subscription)}
                            >
                              <Icon.Trash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Global_Pagination
                page={subscriptionsPage.page}
                totalPages={subscriptionsPage.totalPages}
                onPageChange={subscriptionsPage.setPage}
                totalItems={subscriptionsPage.total}
                pageSize={subscriptionsPage.pageSize}
              />
            </>
          )}
        </div>
      </div>

      <div className="Card Earnings_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('subscriptions.paymentsTitle')}</span>
            <span className="Card_Subtitle">{t('subscriptions.paymentsSubtitle', { count: ahead })}</span>
          </div>
          <div className="Earnings_Controls">
            <div className="Tabs">
              {PERIOD_VIEWS.map((option) => (
                <button key={option} type="button" className={view === option ? 'Active' : ''} onClick={() => setView(option)}>
                  {t(`subscriptions.view_${option}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="Earnings_Body">
          {!state.data ? (
            <span className="Earnings_Message">{t('common.loading')}</span>
          ) : periods.length === 0 ? (
            <div className="Empty_State">
              <span className="Empty_State_Title">{t(`subscriptions.paymentsEmpty_${view}`)}</span>
            </div>
          ) : (
            <>
              <div className="Table_Wrap">
                <table className="Table">
                  <thead>
                    <tr>
                      <th>{t('expenses.date')}</th>
                      <th>{t('subscriptions.name')}</th>
                      <th>{t('subscriptions.period')}</th>
                      <th className="Right">{t('expenses.value')}</th>
                      <th />
                      <th className="Earnings_Col_Action" />
                    </tr>
                  </thead>
                  <tbody>
                    {periodsPage.pageItems.map((period) => {
                      const subscription = byId.get(period.subscriptionId) as Personal_Subscription;
                      return (
                        <tr key={`${period.subscriptionId}|${period.period}`}>
                          <td className="Num">{formatDay(period.date, locale)}</td>
                          <td>
                            <span className="Earnings_Strong">{subscription.name}</span>
                            <div className="Earnings_Sub">{t(`subscriptions.kind_${subscription.kind}`)}</div>
                          </td>
                          <td className="Subscription_Period">{periodLabel(period)}</td>
                          <td className="Right Num">{formatIn(period.amount, subscription.currency.shortCode)}</td>
                          <td>
                            <span className={`Pill ${period.paid ? 'Ok' : period.overdue ? 'Bad' : 'Warn'}`}>
                              {t(period.paid ? 'subscriptions.paid' : period.overdue ? 'subscriptions.overdue' : 'subscriptions.due')}
                            </span>
                          </td>
                          <td>
                            {period.paid ? (
                              <button type="button" className="Earnings_Link" disabled={state.saving} onClick={() => void togglePaid(period)}>
                                {t('subscriptions.undo')}
                              </button>
                            ) : (
                              <button type="button" className="Earnings_Action" disabled={state.saving} onClick={() => void togglePaid(period)}>
                                {t('subscriptions.markPaid')}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Global_Pagination
                page={periodsPage.page}
                totalPages={periodsPage.totalPages}
                onPageChange={periodsPage.setPage}
                totalItems={periodsPage.total}
                pageSize={periodsPage.pageSize}
              />
            </>
          )}
        </div>
      </div>

      {editing && (
        <Subscription_Popover
          subscription={editing.subscription}
          categories={state.categories}
          bankAccounts={state.bankAccounts}
          saving={state.saving}
          error={state.actionError}
          onClose={close}
          onSave={async (body) => {
            if (await state.saveSubscription(editing.subscription?.id ?? null, body)) close();
          }}
        />
      )}

      {deleting && (
        <Confirm_Popover
          title={t('subscriptions.deleteTitle')}
          subtitle={deleting.name}
          message={t('subscriptions.deleteConfirm')}
          confirmText={t('common.delete')}
          saving={state.saving}
          onClose={close}
          onConfirm={async () => {
            if (await state.deleteSubscription(deleting.id)) close();
            else setAlert({ open: true, message: t('earnings.deleteFailed'), type: 'error' });
          }}
        />
      )}
    </>
  );
};

export default Subscriptions_Tab;
