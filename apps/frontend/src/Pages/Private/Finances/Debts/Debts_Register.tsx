import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../../Contexts/Alert_Context';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import { useDayRates } from '../../../../Hooks/Finances/useDayRates';
import Converted_Amount from '../Earnings/Converted_Amount';
import {
  DEBT_MOVEMENT_KINDS,
  useDebtRegister,
  type Debt_Due,
  type Debt_Movement,
  type Debt_Movement_Filters,
  type Personal_Debt,
} from '../../../../Hooks/Finances/usePersonalDebt';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import { usePagedList } from '../../../../Hooks/usePagedList';
import * as Icon from '../../../../Imports/icons';
import Confirm_Popover from '../../Companies/Company_Members/Confirm_Popover';
import Debt_Popover from './Debt_Popover';
import Debt_Movement_Popover from './Debt_Movement_Popover';
import { formatDay, localeOf } from '../Earnings/earningsLabels';
import { formatMonth, installmentLabel } from './debtsLabels';
import '../Earnings/Earnings.scss';
import './Debts.scss';

// Quantos meses à frente se veem as prestações por pagar
const DUE_PERIODS = [1, 3, 6];

const EMPTY_FILTERS: Debt_Movement_Filters = { debtId: '', kind: '', from: '', to: '' };

type Editing =
  | { kind: 'debt'; debt: Personal_Debt | null }
  | { kind: 'movement'; movement: Debt_Movement | null; due: Debt_Due | null; debtId?: string };

type Deleting = { kind: 'debt'; item: Personal_Debt } | { kind: 'movement'; item: Debt_Movement };

/**
 * O registo das dívidas: os filtros num cartão à parte e os movimentos, depois
 * as prestações por pagar (calculadas no backend a partir do plano de cada
 * dívida — pagar grava o movimento e ela sai da lista) e as dívidas com o saldo
 * e o que falta, cada tabela às páginas de 10 com o seu botão de acrescentar no
 * cabeçalho.
 */
const Debts_Register = () => {
  const { t, i18n } = useTranslation();
  const { formatIn } = useCurrencyFormat();
  const { setAlert } = useAlert();
  const locale = localeOf(i18n.language);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [dueMonths, setDueMonths] = useState(3);
  const state = useDebtRegister(filters, dueMonths);
  // Os valores na moeda do topo: os movimentos e as prestações pela cotação do dia, os saldos pela de hoje
  const rated = useDayRates([
    ...(state.movements ?? []).map((movement) => ({ currency: movement.debt.currency, date: movement.date })),
    ...(state.due ?? []),
    ...(state.debts ?? []).map((debt) => ({ currency: debt.currency })),
  ]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<Deleting | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const setFilter = (key: keyof Debt_Movement_Filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const filtered = Object.values(filters).some(Boolean);

  const close = () => {
    setEditing(null);
    setDeleting(null);
    state.clearActionError();
  };

  const debts = (state.debts ?? []).filter((debt) => showClosed || debt.status === 'active');
  const hiddenCount = (state.debts ?? []).length - debts.length;
  // As três tabelas às páginas de 10 linhas
  const duePage = usePagedList(state.due, 10);
  const debtsPage = usePagedList(debts, 10);
  const movementsPage = usePagedList(state.movements, 10);

  return (
    <div className="Earnings">
      {state.error && <span className="Earnings_Message Bad">{state.error}</span>}

      {/* Os filtros dos movimentos */}
      <div className="Card Earnings_Filter_Card">
        <div className="Earnings_Filters">
          <div className="Earnings_Filter Wide">
            <span className="Eyebrow">{t('debts.debt')}</span>
            <Global_Dropdown
              id="movement-filter-debt"
              value={filters.debtId}
              onChange={(value) => setFilter('debtId', String(value))}
              options={[
                { value: '', label: t('earnings.all') },
                ...(state.debts ?? []).map((debt) => ({ value: debt.id, label: debt.name })),
              ]}
            />
          </div>
          <div className="Earnings_Filter">
            <span className="Eyebrow">{t('earnings.filterKind')}</span>
            <div className="Tabs">
              {['', ...DEBT_MOVEMENT_KINDS].map((kind) => (
                <button
                  key={kind || 'all'}
                  type="button"
                  className={filters.kind === kind ? 'Active' : ''}
                  onClick={() => setFilter('kind', kind)}
                >
                  {kind ? t(`debts.movement_${kind}`) : t('earnings.all')}
                </button>
              ))}
            </div>
          </div>
          <div className="Earnings_Filter">
            <span className="Eyebrow">{t('earnings.filterFrom')}</span>
            <Global_Input id="movement-filter-from" type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
          </div>
          <div className="Earnings_Filter">
            <span className="Eyebrow">{t('earnings.filterTo')}</span>
            <Global_Input id="movement-filter-to" type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
          </div>
          {filtered && (
            <button type="button" className="Earnings_Clear" onClick={() => setFilters(EMPTY_FILTERS)}>
              {t('purchasesDashboard.clear')}
            </button>
          )}
        </div>
      </div>

      {/* Os movimentos */}
      <div className="Card Earnings_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('debts.movementsTitle')}</span>
            <span className="Card_Subtitle">{t('debts.movementsSubtitle')}</span>
          </div>
          <div className="Earnings_Controls">
            <Simple_Button
              text={t('debts.addMovement')}
              onClick={() => setEditing({ kind: 'movement', movement: null, due: null })}
            />
          </div>
        </div>

        <div className="Earnings_Body">
          {!state.movements ? (
            <span className="Earnings_Message">{t('common.loading')}</span>
          ) : state.movements.length === 0 ? (
            <div className="Empty_State">
              <span className="Empty_State_Title">{t(filtered ? 'debts.movementsNoMatch' : 'debts.movementsEmpty')}</span>
            </div>
          ) : (
            <>
              <div className="Table_Wrap">
                <table className="Table">
                  <thead>
                    <tr>
                      <th>{t('earnings.date')}</th>
                      <th>{t('debts.debt')}</th>
                      <th>{t('earnings.kind')}</th>
                      <th className="Right">{t('debts.principalPart')}</th>
                      <th className="Right">{t('debts.interestPart')}</th>
                      <th className="Right">{t('earnings.amount')}</th>
                      <th className="Earnings_Col_Icons" />
                    </tr>
                  </thead>
                  <tbody>
                    {movementsPage.pageItems.map((movement) => {
                      const currency = movement.debt.currency;
                      const charge = movement.kind === 'charge';
                      return (
                        <tr key={movement.id}>
                          <td className="Num">{formatDay(movement.date, locale)}</td>
                          <td>
                            <span className="Earnings_Strong">{movement.debt.name}</span>
                            {movement.notes && <div className="Earnings_Sub">{movement.notes}</div>}
                          </td>
                          <td>
                            {t(`debts.movement_${movement.kind}`)}
                            {movement.period && (
                              <div className="Earnings_Sub">{installmentLabel(t, locale, movement.period, movement.debt.direction)}</div>
                            )}
                          </td>
                          <td className="Right Num">{charge ? '—' : rated.money(movement.principalPart ?? movement.amount, currency, movement.date).main}</td>
                          <td className="Right Num">
                            {movement.interestPart || movement.feesPart
                              ? rated.money((movement.interestPart ?? 0) + (movement.feesPart ?? 0), currency, movement.date).main
                              : '—'}
                          </td>
                          <td className={`Right Num${charge ? ' Debt_Charge' : ''}`}>
                            {charge ? '+' : ''}
                            <Converted_Amount value={rated.money(movement.amount, currency, movement.date)} />
                          </td>
                          <td>
                            <div className="Row_Actions">
                              <button
                                type="button"
                                className="Icon_Button Tiny"
                                title={t('common.edit')}
                                aria-label={t('common.edit')}
                                onClick={() => setEditing({ kind: 'movement', movement, due: null })}
                              >
                                <Icon.Edit />
                              </button>
                              <button
                                type="button"
                                className="Icon_Button Tiny"
                                title={t('common.delete')}
                                aria-label={t('common.delete')}
                                onClick={() => setDeleting({ kind: 'movement', item: movement })}
                              >
                                <Icon.Trash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Global_Pagination
                page={movementsPage.page}
                totalPages={movementsPage.totalPages}
                onPageChange={movementsPage.setPage}
                totalItems={movementsPage.total}
                pageSize={movementsPage.pageSize}
              />
            </>
          )}
        </div>
      </div>

      {/* As prestações por pagar */}
      <div className="Card Earnings_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('debts.dueTitle')}</span>
            <span className="Card_Subtitle">{t('debts.dueSubtitle')}</span>
          </div>
          <div className="Earnings_Controls">
            <div className="Tabs">
              {DUE_PERIODS.map((period) => (
                <button key={period} type="button" className={dueMonths === period ? 'Active' : ''} onClick={() => setDueMonths(period)}>
                  {t('purchasesDashboard.months', { count: period })}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="Earnings_Body">
          {!state.due ? (
            <span className="Earnings_Message">{t('common.loading')}</span>
          ) : state.due.length === 0 ? (
            <div className="Empty_State">
              <span className="Empty_State_Title">{t('debts.dueEmpty')}</span>
              <span className="Empty_State_Text">{t('debts.dueEmptyHint')}</span>
            </div>
          ) : (
            <>
              <div className="Table_Wrap">
                <table className="Table">
                  <thead>
                    <tr>
                      <th>{t('earnings.date')}</th>
                      <th>{t('debts.debt')}</th>
                      <th>{t('earnings.what')}</th>
                      <th className="Right">{t('debts.interestEstimate')}</th>
                      <th className="Right">{t('earnings.amount')}</th>
                      <th className="Earnings_Col_Action" />
                    </tr>
                  </thead>
                  <tbody>
                    {duePage.pageItems.map((item) => (
                      <tr key={`${item.debtId}|${item.period}`}>
                        <td className="Num">
                          {formatDay(item.date, locale)}
                          {item.overdue && <span className="Pill Bad Earnings_Pill">{t('earnings.overdue')}</span>}
                        </td>
                        <td>
                          <span className="Earnings_Strong">{item.name}</span>
                          <div className="Earnings_Sub">{t(`debts.kind_${item.kind}`)}</div>
                        </td>
                        <td>{installmentLabel(t, locale, item.period, item.direction)}</td>
                        <td className="Right Num">
                          {item.interestEstimate === null ? '—' : rated.money(item.interestEstimate, item.currency, item.date).main}
                        </td>
                        <td className="Right Num">
                          <Converted_Amount value={rated.money(item.amount, item.currency, item.date)} />
                        </td>
                        <td className="Right">
                          <button
                            type="button"
                            className="Earnings_Action"
                            onClick={() => setEditing({ kind: 'movement', movement: null, due: item })}
                          >
                            {t(item.direction === 'owe' ? 'debts.pay' : 'debts.receive')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Global_Pagination
                page={duePage.page}
                totalPages={duePage.totalPages}
                onPageChange={duePage.setPage}
                totalItems={duePage.total}
                pageSize={duePage.pageSize}
              />
            </>
          )}
        </div>
      </div>

      {/* As dívidas */}
      <div className="Card Earnings_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('debts.debtsTitle')}</span>
            <span className="Card_Subtitle">{t('debts.debtsSubtitle')}</span>
          </div>
          <div className="Earnings_Controls">
            {(hiddenCount > 0 || showClosed) && (
              <button type="button" className="Earnings_Link" onClick={() => setShowClosed(!showClosed)}>
                {showClosed ? t('debts.hideClosed') : t('debts.showClosed', { count: hiddenCount })}
              </button>
            )}
            <Simple_Button text={t('debts.addDebt')} onClick={() => setEditing({ kind: 'debt', debt: null })} />
          </div>
        </div>
        <div className="Earnings_Body">
          {!state.debts ? (
            <span className="Earnings_Message">{t('common.loading')}</span>
          ) : debts.length === 0 ? (
            <div className="Empty_State">
              <span className="Empty_State_Title">{t('debts.debtsEmpty')}</span>
              <span className="Empty_State_Text">{t('debts.debtsEmptyHint')}</span>
            </div>
          ) : (
            <>
              <div className="Table_Wrap">
                <table className="Table">
                  <thead>
                    <tr>
                      <th>{t('debts.name')}</th>
                      <th>{t('debts.kind')}</th>
                      <th>{t('debts.plan')}</th>
                      <th className="Debt_Col_Progress">{t('debts.progress')}</th>
                      <th className="Right">{t('debts.balance')}</th>
                      <th className="Earnings_Col_Icons" />
                    </tr>
                  </thead>
                  <tbody>
                    {debtsPage.pageItems.map((debt) => (
                      <tr key={debt.id} className={debt.status === 'active' ? '' : 'Earnings_Inactive'}>
                        <td>
                          <span className="Earnings_Strong">{debt.name}</span>
                          {debt.direction === 'lent' && <span className="Pill Info Earnings_Pill">{t('debts.direction_lent')}</span>}
                          {debt.status !== 'active' && (
                            <span className={`Pill ${debt.status === 'paid_off' ? 'Ok' : ''} Earnings_Pill`}>
                              {t(`debts.status_${debt.status}`)}
                            </span>
                          )}
                          <div className="Earnings_Sub">{debt.platform?.name ?? debt.counterparty ?? '—'}</div>
                        </td>
                        <td>{t(`debts.kind_${debt.kind}`)}</td>
                        <td>
                          {debt.installment
                            ? t('debts.planLine', {
                                amount: rated.money(debt.installment, debt.currency).main,
                                day: debt.paymentDay ?? '—',
                              })
                            : t('debts.noPlan')}
                          {debt.interestRate !== null && (
                            <div className="Earnings_Sub">
                              {t('debts.rateLine', {
                                rate: debt.interestRate.toLocaleString(locale, { maximumFractionDigits: 3 }),
                                type: debt.rateType ? t(`debts.rate_${debt.rateType}`) : '',
                              })}
                            </div>
                          )}
                        </td>
                        <td className="Debt_Col_Progress">
                          <div className="Earnings_Share_Track">
                            <div
                              className={`Earnings_Share_Fill${debt.direction === 'lent' ? ' Accent' : ''}`}
                              style={{ width: `${debt.paidPct}%` }}
                            />
                          </div>
                          <div className="Earnings_Sub">
                            {t('debts.progressLine', {
                              pct: Math.round(debt.paidPct),
                              end: debt.projectedEnd ? formatMonth(debt.projectedEnd, locale) : '—',
                            })}
                          </div>
                        </td>
                        <td className="Right Num">
                          <span className="Earnings_Strong">{rated.money(debt.balance, debt.currency).main}</span>
                          <div className="Earnings_Sub">
                            {t('debts.ofPrincipal', { amount: rated.money(debt.principal, debt.currency).main })}
                          </div>
                          {rated.money(debt.balance, debt.currency).original && (
                            <div className="Earnings_Sub">{rated.money(debt.balance, debt.currency).original}</div>
                          )}
                        </td>
                        <td>
                          <div className="Row_Actions">
                            <button
                              type="button"
                              className="Icon_Button Tiny"
                              title={t('debts.addMovement')}
                              aria-label={t('debts.addMovement')}
                              onClick={() => setEditing({ kind: 'movement', movement: null, due: null, debtId: debt.id })}
                            >
                              <Icon.Plus />
                            </button>
                            <button
                              type="button"
                              className="Icon_Button Tiny"
                              title={t('common.edit')}
                              aria-label={t('common.edit')}
                              onClick={() => setEditing({ kind: 'debt', debt })}
                            >
                              <Icon.Edit />
                            </button>
                            <button
                              type="button"
                              className="Icon_Button Tiny"
                              title={t('common.delete')}
                              aria-label={t('common.delete')}
                              onClick={() => setDeleting({ kind: 'debt', item: debt })}
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
                page={debtsPage.page}
                totalPages={debtsPage.totalPages}
                onPageChange={debtsPage.setPage}
                totalItems={debtsPage.total}
                pageSize={debtsPage.pageSize}
              />
            </>
          )}
        </div>
      </div>

      {editing?.kind === 'debt' && (
        <Debt_Popover
          debt={editing.debt}
          banks={state.banks}
          bankAccounts={state.bankAccounts}
          saving={state.saving}
          error={state.actionError}
          onClose={close}
          onSave={async (body) => {
            if (await state.saveDebt(editing.debt?.id ?? null, body)) close();
          }}
        />
      )}

      {editing?.kind === 'movement' && (
        <Debt_Movement_Popover
          movement={editing.movement}
          due={editing.due}
          debtId={editing.debtId}
          dueLabel={
            editing.due ? `${installmentLabel(t, locale, editing.due.period, editing.due.direction)} · ${editing.due.name}` : undefined
          }
          debts={state.debts ?? []}
          bankAccounts={state.bankAccounts}
          saving={state.saving}
          error={state.actionError}
          onClose={close}
          onSave={async (body) => {
            if (await state.saveMovement(editing.movement?.id ?? null, body)) close();
          }}
        />
      )}

      {deleting && (
        <Confirm_Popover
          title={t(deleting.kind === 'debt' ? 'debts.deleteDebt' : 'debts.deleteMovement')}
          subtitle={
            deleting.kind === 'debt'
              ? deleting.item.name
              : `${formatDay(deleting.item.date, locale)} · ${formatIn(deleting.item.amount, deleting.item.debt.currency.shortCode)}`
          }
          message={
            deleting.kind === 'debt'
              ? t('debts.deleteDebtConfirm', { count: deleting.item.movementsCount })
              : t('debts.deleteMovementConfirm')
          }
          confirmText={t('common.delete')}
          saving={state.saving}
          onClose={close}
          onConfirm={async () => {
            const done = deleting.kind === 'debt' ? await state.deleteDebt(deleting.item.id) : await state.deleteMovement(deleting.item.id);
            if (done) close();
            else setAlert({ open: true, message: t('earnings.deleteFailed'), type: 'error' });
          }}
        />
      )}
    </div>
  );
};

export default Debts_Register;
