import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../../Contexts/Alert_Context';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import { useDayRates } from '../../../../Hooks/Finances/useDayRates';
import Converted_Amount from '../Earnings/Converted_Amount';
import {
  EXPENSE_FILTER_KINDS,
  useExpenseRegister,
  type Expense_Filters,
  type Personal_Expense,
} from '../../../../Hooks/Finances/usePersonalExpense';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import { usePagedList } from '../../../../Hooks/usePagedList';
import * as Icon from '../../../../Imports/icons';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';
import { formatDay, localeOf } from '../Earnings/earningsLabels';
import Expense_Popover from './Expense_Popover';
import { categoryLabel, categoryOptions, categoryPath } from './expensesShared';
import '../Earnings/Earnings.scss';
import './Expenses.scss';
import { activateOnKey } from '../../../../utils/rowKeyboard';

const EMPTY_FILTERS: Expense_Filters = { from: '', to: '', kind: '', categoryId: '', q: '' };

type Editing = { kind: 'expense'; expense: Personal_Expense | null };

/**
 * O registo das despesas: a tabela com os filtros (datas, tipo, categoria e a
 * procura na loja, descrição e produtos; cada linha abre as compras dela) e as
 * categorias e subcategorias.
 */
const Expenses_Register = () => {
  const { t, i18n } = useTranslation();
  const { formatIn } = useCurrencyFormat();
  const { setAlert } = useAlert();
  const locale = localeOf(i18n.language);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const state = useExpenseRegister(filters);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<Personal_Expense | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  // A tabela às páginas de 10 linhas
  const expensesPage = usePagedList(state.expenses, 10);

  const setFilter = (key: keyof Expense_Filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const filtered = Object.values(filters).some(Boolean);
  const close = () => {
    setEditing(null);
    setDeleting(null);
    state.clearActionError();
  };

  const productCategory = (productId: string | null) =>
    categoryPath(state.itemCategories, state.products.find((product) => product.id === productId)?.categoryId ?? null);
  // Os valores na moeda do topo, pela cotação do dia de cada um
  const rated = useDayRates(state.expenses ?? []);
  const paidTotal = rated.total((state.expenses ?? []).filter((expense) => expense.status === 'paid'));

  return (
    <div className="Earnings">
      {state.error && <span className="Earnings_Message Bad">{state.error}</span>}

      <div className="Card Earnings_Filter_Card">
        <div className="Earnings_Filters">
          <div className="Earnings_Filter Wide">
            <label className="Eyebrow" htmlFor="expense-filter-q">{t('expenses.search')}</label>
            <Global_Input id="expense-filter-q" value={filters.q} onChange={(e) => setFilter('q', e.target.value)} icon={Icon.Search} />
          </div>
          <div className="Earnings_Filter">
            <label className="Eyebrow" htmlFor="expense-filter-from">{t('earnings.filterFrom')}</label>
            <Global_Input id="expense-filter-from" type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
          </div>
          <div className="Earnings_Filter">
            <label className="Eyebrow" htmlFor="expense-filter-to">{t('earnings.filterTo')}</label>
            <Global_Input id="expense-filter-to" type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
          </div>
          <div className="Earnings_Filter Wide">
            <label className="Eyebrow" htmlFor="expense-filter-category">{t('expenses.category')}</label>
            <Global_Dropdown
              id="expense-filter-category"
              value={filters.categoryId}
              onChange={(value) => setFilter('categoryId', String(value))}
              options={categoryOptions(state.categories, t('earnings.all'))}
            />
          </div>
          <div className="Earnings_Filter Wide">
            <label className="Eyebrow" htmlFor="expense-filter-kind">{t('earnings.filterKind')}</label>
            <Global_Dropdown
              id="expense-filter-kind"
              value={filters.kind}
              onChange={(value) => setFilter('kind', String(value))}
              options={['', ...EXPENSE_FILTER_KINDS].map((kind) => ({
                value: kind,
                label: kind ? t(`expenses.kind_${kind}`) : t('earnings.all'),
              }))}
            />
          </div>
          {filtered && (
            <button type="button" className="Earnings_Clear" onClick={() => setFilters(EMPTY_FILTERS)}>
              {t('purchasesDashboard.clear')}
            </button>
          )}
        </div>
      </div>

      <div className="Card Earnings_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('expenses.listTitle')}</span>
            <span className="Card_Subtitle">
              {state.expenses && state.expenses.length > 0
                ? t('expenses.listSummary', {
                    count: state.expenses.length,
                    total: paidTotal,
                  })
                : t('expenses.listSubtitle')}
            </span>
          </div>
          <div className="Earnings_Controls">
            <Simple_Button text={t('expenses.add')} onClick={() => setEditing({ kind: 'expense', expense: null })} />
          </div>
        </div>

        <div className="Earnings_Body">
          {!state.expenses ? (
            <span className="Earnings_Message">{t('common.loading')}</span>
          ) : state.expenses.length === 0 ? (
            <div className="Empty_State">
              <span className="Empty_State_Title">{t(filtered ? 'expenses.noMatch' : 'expenses.empty')}</span>
              {!filtered && <span className="Empty_State_Text">{t('expenses.emptyHint')}</span>}
            </div>
          ) : (
            <>
              <div className="Table_Wrap">
                <table className="Table">
                  <thead>
                    <tr>
                      <th>{t('expenses.date')}</th>
                      <th>{t('expenses.where')}</th>
                      <th>{t('expenses.category')}</th>
                      <th>{t('expenses.what')}</th>
                      <th>{t('expenses.account')}</th>
                      <th className="Right">{t('expenses.value')}</th>
                      <th />
                      <th className="Earnings_Col_Icons" />
                    </tr>
                  </thead>
                  <tbody>
                    {expensesPage.pageItems.map((expense) => (
                      <Fragment key={expense.id}>
                        <tr
                          className={expense.items.length > 0 ? 'Expense_Row_Open' : ''}
                          onClick={() => expense.items.length > 0 && setOpen(open === expense.id ? null : expense.id)} tabIndex={expense.items.length > 0 ? 0 : undefined} onKeyDown={activateOnKey} aria-expanded={expense.items.length > 0 ? open === expense.id : undefined}
                        >
                          <td className="Num">{formatDay(expense.date, locale)}</td>
                          <td>
                            <span className="Earnings_Strong">{expense.company?.name ?? expense.merchant ?? '—'}</span>
                            <div className="Earnings_Sub">{t(`expenses.kind_${expense.kind}`)}</div>
                          </td>
                          <td>{categoryLabel(state.categories, expense.categoryId) ?? '—'}</td>
                          <td>
                            {expense.description ?? (expense.items.length > 0 ? expense.items.map((item) => item.name).slice(0, 3).join(', ') : '—')}
                            {expense.items.length > 0 && (
                              <div className="Earnings_Sub">{t('expenses.lines', { count: expense.items.length })}</div>
                            )}
                          </td>
                          <td>{expense.bankAccount?.name ?? '—'}</td>
                          <td className="Right Num">
                            <Converted_Amount value={rated.money(expense.amount, expense.currency, expense.date)} />
                          </td>
                          <td>
                            <span className={`Pill ${expense.status === 'paid' ? 'Ok' : 'Warn'}`}>{t(`expenses.status_${expense.status}`)}</span>
                          </td>
                          <td>
                            <div className="Row_Actions">
                              <button
                                type="button"
                                className="Icon_Button Tiny"
                                title={t('common.edit')}
                                aria-label={t('common.edit')}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditing({ kind: 'expense', expense });
                                }}
                              >
                                <Icon.Edit />
                              </button>
                              <button
                                type="button"
                                className="Icon_Button Tiny"
                                title={t('common.delete')}
                                aria-label={t('common.delete')}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleting(expense);
                                }}
                              >
                                <Icon.Trash />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {open === expense.id && (
                          <tr className="Expense_Items_Row">
                            <td colSpan={8}>
                              <div className="Expense_Items">
                                {expense.items.map((item) => (
                                  <div key={item.id} className="Expense_Item">
                                    <span className="Earnings_Strong">{item.name}</span>
                                    <span className="Earnings_Sub">{productCategory(item.productId) ?? '—'}</span>
                                    <span className="Num">
                                      {item.quantity} × {rated.money(item.unitPrice, expense.currency, expense.date).main}
                                    </span>
                                    <span className="Num Right">
                                      {rated.money(item.amount, expense.currency, expense.date).main}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <Global_Pagination
                page={expensesPage.page}
                totalPages={expensesPage.totalPages}
                onPageChange={expensesPage.setPage}
                totalItems={expensesPage.total}
                pageSize={expensesPage.pageSize}
              />
            </>
          )}
        </div>
      </div>

      {editing?.kind === 'expense' && (
        <Expense_Popover
          expense={editing.expense}
          categories={state.categories}
          itemCategories={state.itemCategories}
          products={state.products}
          companies={state.companies}
          bankAccounts={state.bankAccounts}
          saving={state.saving}
          error={state.actionError}
          onClose={close}
          onSave={async (body) => {
            if (await state.saveExpense(editing.expense?.id ?? null, body)) close();
          }}
        />
      )}

      {deleting && (
        <Confirm_Popover
          title={t('expenses.deleteTitle')}
          subtitle={`${formatDay(deleting.date, locale)} · ${formatIn(deleting.amount, deleting.currency.shortCode)}`}
          message={t(deleting.companyPaymentId ? 'expenses.deleteCompanyConfirm' : 'expenses.deleteConfirm')}
          confirmText={t('common.delete')}
          busy={state.saving}
          onClose={close}
          onConfirm={async () => {
            if (await state.deleteExpense(deleting.id)) close();
            else setAlert({ open: true, message: t('earnings.deleteFailed'), type: 'error' });
          }}
        />
      )}
    </div>
  );
};

export default Expenses_Register;
