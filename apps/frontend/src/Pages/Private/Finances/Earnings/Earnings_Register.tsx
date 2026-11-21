import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../../Contexts/Alert_Context';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import { useDayRates } from '../../../../Hooks/Finances/useDayRates';
import {
  INCOME_KINDS,
  useIncomeRegister,
  type Expected_Income,
  type Income_Filters,
  type Income_Source,
  type Personal_Income,
} from '../../../../Hooks/Finances/usePersonalIncome';
import { invitationsApi } from '../../../../Hooks/System/useInvitations';
import { getErrorMessage } from '../../../../Hooks/useAsyncRequest';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Pagination from '../../../../Components/Pagination/Global_Pagination/Global_Pagination';
import { usePagedList } from '../../../../Hooks/usePagedList';
import * as Icon from '../../../../Imports/icons';
import Confirm_Popover from '../../../../Components/Confirm_Popover/Confirm_Popover';
import Income_Popover from './Income_Popover';
import Income_Source_Popover from './Income_Source_Popover';
import Converted_Amount from './Converted_Amount';
import { expectedPartLabel, formatDay, localeOf } from './earningsLabels';
import './Earnings.scss';

// Quantos meses à frente se veem os por receber
const EXPECTED_PERIODS = [1, 3, 6];

const EMPTY_FILTERS: Income_Filters = { from: '', to: '', kind: '', sourceId: '', status: '' };

type Editing =
  | { kind: 'income'; income: Personal_Income | null; expected: Expected_Income | null }
  | { kind: 'source'; source: Income_Source | null };

type Deleting = { kind: 'income'; item: Personal_Income } | { kind: 'source'; item: Income_Source };

/**
 * O registo dos ganhos: os filtros num cartão à parte e os ganhos registados,
 * depois os por receber (os salários das fontes e das empresas que pagam a esta
 * pessoa, calculados no backend — marcar como recebido grava o ganho e ele sai
 * da lista) e as fontes, cada tabela às páginas de 10 com o seu botão de
 * acrescentar no cabeçalho.
 */
const Earnings_Register = () => {
  const { t, i18n } = useTranslation();
  const groupId = useId();
  const navigate = useNavigate();
  const { formatIn } = useCurrencyFormat();
  const { setAlert } = useAlert();
  const locale = localeOf(i18n.language);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [expectedMonths, setExpectedMonths] = useState(3);
  const state = useIncomeRegister(filters, expectedMonths);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<Deleting | null>(null);
  // As horas que a empresa já pagou: confirmar que se recebeu
  const [confirming, setConfirming] = useState<string | null>(null);
  const confirmPayout = async (payoutId: string) => {
    setConfirming(payoutId);
    try {
      await invitationsApi.confirmPayment('time_tracking', payoutId, true);
      setAlert({ open: true, type: 'success', message: t('invitations.confirmed') });
      state.reload();
    } catch (reason) {
      setAlert({ open: true, type: 'error', message: getErrorMessage(reason) });
    } finally {
      setConfirming(null);
    }
  };
  // As três tabelas às páginas de 10 linhas
  const expectedPage = usePagedList(state.expected, 10);
  const incomesPage = usePagedList(state.incomes, 10);
  const sourcesPage = usePagedList(state.sources, 10);

  const setFilter = (key: keyof Income_Filters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const filtered = Object.values(filters).some(Boolean);

  const close = () => {
    setEditing(null);
    setDeleting(null);
    state.clearActionError();
  };

  const expectedLabel = (income: Expected_Income) =>
    `${expectedPartLabel(t, locale, income.part, income.period)} · ${income.name}`;

  // De onde veio um ganho registado: a fonte, ou a empresa que paga
  const originOf = (income: Personal_Income) => income.source?.name ?? income.company?.name ?? '—';

  // Os valores na moeda do topo, pela cotação do dia de cada um
  const rated = useDayRates([...(state.incomes ?? []), ...(state.expected ?? [])]);
  const receivedTotal = rated.total((state.incomes ?? []).filter((income) => income.status === 'received'));

  const salaryOf = (source: Income_Source) => {
    if (!source.payDay || !source.currency) return t('earnings.noFixedSalary');
    const value = source.netAmount ?? source.grossAmount ?? 0;
    return t('earnings.fixedSalary', {
      amount: formatIn(value, source.currency.shortCode),
      day: source.payDay,
      times: source.paymentsPerYear ?? 12,
    });
  };

  return (
    <div className="Earnings">
      {state.error && <span className="Earnings_Message Bad">{state.error}</span>}

      {/* Os filtros dos registados */}
      <div className="Card Earnings_Filter_Card">
        <div className="Earnings_Filters">
          <div className="Earnings_Filter">
            <label className="Eyebrow" htmlFor="income-filter-from">{t('earnings.filterFrom')}</label>
            <Global_Input id="income-filter-from" type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
          </div>
          <div className="Earnings_Filter">
            <label className="Eyebrow" htmlFor="income-filter-to">{t('earnings.filterTo')}</label>
            <Global_Input id="income-filter-to" type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
          </div>
          <div className="Earnings_Filter Wide">
            <label className="Eyebrow" htmlFor="income-filter-kind">{t('earnings.filterKind')}</label>
            <Global_Dropdown
              id="income-filter-kind"
              value={filters.kind}
              onChange={(value) => setFilter('kind', String(value))}
              options={[
                { value: '', label: t('earnings.all') },
                ...INCOME_KINDS.map((kind) => ({ value: kind, label: t(`earnings.kind_${kind}`) })),
              ]}
            />
          </div>
          <div className="Earnings_Filter Wide">
            <label className="Eyebrow" htmlFor="income-filter-source">{t('earnings.filterSource')}</label>
            <Global_Dropdown
              id="income-filter-source"
              value={filters.sourceId}
              onChange={(value) => setFilter('sourceId', String(value))}
              options={[
                { value: '', label: t('earnings.all') },
                ...state.sources.map((source) => ({ value: source.id, label: source.name })),
              ]}
            />
          </div>
          <div className="Earnings_Filter">
            <span className="Eyebrow" id={`${groupId}-filterStatus`}>{t('earnings.filterStatus')}</span>
            <div className="Tabs" role="group" aria-labelledby={`${groupId}-filterStatus`}>
              {['', 'received', 'pending'].map((status) => (
                <button
                  key={status || 'all'}
                  type="button"
                  className={filters.status === status ? 'Active' : ''} aria-pressed={filters.status === status}
                  onClick={() => setFilter('status', status)}
                >
                  {status ? t(`earnings.status_${status}`) : t('earnings.all')}
                </button>
              ))}
            </div>
          </div>
          {filtered && (
            <button type="button" className="Earnings_Clear" onClick={() => setFilters(EMPTY_FILTERS)}>
              {t('purchasesDashboard.clear')}
            </button>
          )}
        </div>
      </div>

      {/* Os registados */}
      <div className="Card Earnings_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('earnings.incomesTitle')}</span>
            <span className="Card_Subtitle">
              {state.incomes && state.incomes.length > 0
                ? t('earnings.incomesSummary', {
                    count: state.incomes.length,
                    total: receivedTotal,
                  })
                : t('earnings.incomesSubtitle')}
            </span>
          </div>
          <div className="Earnings_Controls">
            <Simple_Button
              text={t('earnings.addIncome')}
              onClick={() => setEditing({ kind: 'income', income: null, expected: null })}
            />
          </div>
        </div>

        <div className="Earnings_Body">
          {!state.incomes ? (
            <span className="Earnings_Message">{t('common.loading')}</span>
          ) : state.incomes.length === 0 ? (
            <div className="Empty_State">
              <span className="Empty_State_Title">{t(filtered ? 'earnings.incomesNoMatch' : 'earnings.incomesEmpty')}</span>
              {!filtered && <span className="Empty_State_Text">{t('earnings.incomesEmptyHint')}</span>}
            </div>
          ) : (
            <>
              <div className="Table_Wrap">
                <table className="Table">
                  <thead>
                    <tr>
                      <th>{t('earnings.date')}</th>
                      <th>{t('earnings.kind')}</th>
                      <th>{t('earnings.from')}</th>
                      <th>{t('earnings.description')}</th>
                      <th>{t('earnings.account')}</th>
                      <th className="Right">{t('earnings.amount')}</th>
                      <th />
                      <th className="Earnings_Col_Icons" />
                    </tr>
                  </thead>
                  <tbody>
                    {incomesPage.pageItems.map((income) => (
                      <tr key={income.id}>
                        <td className="Num">{formatDay(income.date, locale)}</td>
                        <td>{t(`earnings.kind_${income.kind}`)}</td>
                        <td>
                          {originOf(income)}
                          {income.period && (
                            <div className="Earnings_Sub">
                              {expectedPartLabel(
                                t,
                                locale,
                                income.period === 'once'
                                  ? 'freelance'
                                  : income.period.endsWith(':holiday')
                                    ? 'holiday'
                                    : income.period.endsWith(':christmas')
                                      ? 'christmas'
                                      : 'salary',
                                income.period,
                              )}
                            </div>
                          )}
                        </td>
                        <td>{income.description ?? '—'}</td>
                        <td>{income.bankAccount?.name ?? '—'}</td>
                        <td className="Right Num">
                          <Converted_Amount value={rated.money(income.amount, income.currency, income.date)} />
                          {income.grossAmount ? (
                            <div className="Earnings_Sub">
                              {t('earnings.grossShort', {
                                amount: rated.money(income.grossAmount, income.currency, income.date).main,
                              })}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <span className={`Pill ${income.status === 'received' ? 'Ok' : 'Warn'}`}>
                            {t(`earnings.status_${income.status}`)}
                          </span>
                        </td>
                        <td>
                          <div className="Row_Actions">
                            <button
                              type="button"
                              className="Icon_Button Tiny"
                              title={t('common.edit')}
                              aria-label={t('common.edit')}
                              onClick={() => setEditing({ kind: 'income', income, expected: null })}
                            >
                              <Icon.Edit />
                            </button>
                            <button
                              type="button"
                              className="Icon_Button Tiny"
                              title={t('common.delete')}
                              aria-label={t('common.delete')}
                              onClick={() => setDeleting({ kind: 'income', item: income })}
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
                page={incomesPage.page}
                totalPages={incomesPage.totalPages}
                onPageChange={incomesPage.setPage}
                totalItems={incomesPage.total}
                pageSize={incomesPage.pageSize}
              />
            </>
          )}
        </div>
      </div>

      {/* Os por receber */}
      <div className="Card Earnings_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('earnings.expectedTitle')}</span>
            <span className="Card_Subtitle">{t('earnings.expectedSubtitle')}</span>
          </div>
          <div className="Earnings_Controls">
            <div className="Tabs">
              {EXPECTED_PERIODS.map((period) => (
                <button
                  key={period}
                  type="button"
                  className={expectedMonths === period ? 'Active' : ''} aria-pressed={expectedMonths === period}
                  onClick={() => setExpectedMonths(period)}
                >
                  {t('purchasesDashboard.months', { count: period })}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="Earnings_Body">
          {!state.expected ? (
            <span className="Earnings_Message">{t('common.loading')}</span>
          ) : state.expected.length === 0 ? (
            <div className="Empty_State">
              <span className="Empty_State_Title">{t('earnings.expectedEmpty')}</span>
              <span className="Empty_State_Text">{t('earnings.expectedEmptyHint')}</span>
            </div>
          ) : (
            <>
              <div className="Table_Wrap">
                <table className="Table">
                  <thead>
                    <tr>
                      <th>{t('earnings.date')}</th>
                      <th>{t('earnings.from')}</th>
                      <th>{t('earnings.what')}</th>
                      <th className="Right">{t('earnings.amount')}</th>
                      <th className="Earnings_Col_Action" />
                    </tr>
                  </thead>
                  <tbody>
                    {expectedPage.pageItems.map((income) => (
                      <tr key={`${income.origin}|${income.part}|${income.payoutId ?? ''}|${income.memberPayId ?? income.sourceId ?? income.company?.id}|${income.name}|${income.period}`}>
                        <td className="Num">
                          {formatDay(income.date, locale)}
                          {income.overdue && <span className="Pill Bad Earnings_Pill">{t('earnings.overdue')}</span>}
                        </td>
                        <td>
                          <span className="Earnings_Strong">{income.name}</span>
                          {income.origin === 'company' && (
                            <span className="Pill Info Earnings_Pill">{t('earnings.fromCompany')}</span>
                          )}
                          {income.origin === 'time_tracking' && (
                            <span className="Pill Info Earnings_Pill">{t('earnings.fromTimeTracking')}</span>
                          )}
                        </td>
                        <td>
                          {expectedPartLabel(t, locale, income.part, income.period)}
                          {income.description && <div className="Earnings_Sub">{income.description}</div>}
                          {income.companyPaid && (
                            <div className="Earnings_Sub Earnings_Paid">{t('earnings.companyPaid')}</div>
                          )}
                        </td>
                        <td className="Right Num">
                          <Converted_Amount value={rated.money(income.amount, income.currency, income.date)} />
                        </td>
                        <td className="Right">
                          {income.payoutId ? (
                            // A empresa já pagou estas horas: confirmar cria o ganho (recebido)
                            <button
                              type="button"
                              className="Earnings_Action"
                              disabled={confirming === income.payoutId}
                              onClick={() => void confirmPayout(income.payoutId!)}
                            >
                              {t('earnings.confirmReceived')}
                            </button>
                          ) : income.origin === 'time_tracking' ? (
                            // As horas pagam-se no banco de horas da empresa, não aqui
                            <button
                              type="button"
                              className="Earnings_Action"
                              onClick={() => navigate(`/Companies/${income.company?.slug}/horas/registo`)}
                            >
                              {t('earnings.openTimeTracking')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="Earnings_Action"
                              onClick={() => setEditing({ kind: 'income', income: null, expected: income })}
                            >
                              {t('earnings.receive')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Global_Pagination
                page={expectedPage.page}
                totalPages={expectedPage.totalPages}
                onPageChange={expectedPage.setPage}
                totalItems={expectedPage.total}
                pageSize={expectedPage.pageSize}
              />
            </>
          )}
        </div>
      </div>

      {/* As fontes */}
      <div className="Card Earnings_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('earnings.sourcesTitle')}</span>
            <span className="Card_Subtitle">{t('earnings.sourcesSubtitle')}</span>
          </div>
          <div className="Earnings_Controls">
            <Simple_Button text={t('earnings.addSource')} onClick={() => setEditing({ kind: 'source', source: null })} />
          </div>
        </div>
        <div className="Earnings_Body">
          {state.sources.length === 0 ? (
            <div className="Empty_State">
              <span className="Empty_State_Title">{t('earnings.sourcesEmpty')}</span>
              <span className="Empty_State_Text">{t('earnings.sourcesEmptyHint')}</span>
            </div>
          ) : (
            <>
              <div className="Table_Wrap">
                <table className="Table">
                  <thead>
                    <tr>
                      <th>{t('earnings.sourceName')}</th>
                      <th>{t('earnings.kind')}</th>
                      <th>{t('earnings.sourceCompany')}</th>
                      <th>{t('earnings.salary')}</th>
                      <th className="Right">{t('earnings.incomesCount')}</th>
                      <th className="Earnings_Col_Icons" />
                    </tr>
                  </thead>
                  <tbody>
                    {sourcesPage.pageItems.map((source) => (
                      <tr key={source.id} className={source.isActive ? '' : 'Earnings_Inactive'}>
                        <td>
                          <span className="Earnings_Strong">{source.name}</span>
                          {!source.isActive && <span className="Pill Earnings_Pill">{t('common.inactive')}</span>}
                        </td>
                        <td>{t(`earnings.sourceKind_${source.kind}`)}</td>
                        <td>
                          {source.company ? (
                            <button
                              type="button"
                              className="Earnings_Link"
                              onClick={() => navigate(`/Companies/${source.company?.slug}`)}
                            >
                              {source.company.name}
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{salaryOf(source)}</td>
                        <td className="Right Num">{source._count.incomes}</td>
                        <td>
                          <div className="Row_Actions">
                            <button
                              type="button"
                              className="Icon_Button Tiny"
                              title={t('common.edit')}
                              aria-label={t('common.edit')}
                              onClick={() => setEditing({ kind: 'source', source })}
                            >
                              <Icon.Edit />
                            </button>
                            {source._count.incomes === 0 && (
                              <button
                                type="button"
                                className="Icon_Button Tiny"
                                title={t('common.delete')}
                                aria-label={t('common.delete')}
                                onClick={() => setDeleting({ kind: 'source', item: source })}
                              >
                                <Icon.Trash />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Global_Pagination
                page={sourcesPage.page}
                totalPages={sourcesPage.totalPages}
                onPageChange={sourcesPage.setPage}
                totalItems={sourcesPage.total}
                pageSize={sourcesPage.pageSize}
              />
            </>
          )}
        </div>
      </div>

      {editing?.kind === 'income' && (
        <Income_Popover
          income={editing.income}
          expected={editing.expected}
          expectedLabel={editing.expected ? expectedLabel(editing.expected) : undefined}
          sources={state.sources}
          bankAccounts={state.bankAccounts}
          saving={state.saving}
          error={state.actionError}
          onClose={close}
          onSave={async (body) => {
            if (await state.saveIncome(editing.income?.id ?? null, body)) close();
          }}
        />
      )}

      {editing?.kind === 'source' && (
        <Income_Source_Popover
          source={editing.source}
          companies={state.companies}
          saving={state.saving}
          error={state.actionError}
          onClose={close}
          onSave={async (body) => {
            if (await state.saveSource(editing.source?.id ?? null, body)) close();
          }}
        />
      )}

      {deleting && (
        <Confirm_Popover
          title={t(deleting.kind === 'income' ? 'earnings.deleteIncome' : 'earnings.deleteSource')}
          subtitle={
            deleting.kind === 'income'
              ? `${formatDay(deleting.item.date, locale)} · ${formatIn(deleting.item.amount, deleting.item.currency.shortCode)}`
              : deleting.item.name
          }
          message={t(deleting.kind === 'income' ? 'earnings.deleteIncomeConfirm' : 'earnings.deleteSourceConfirm')}
          confirmText={t('common.delete')}
          busy={state.saving}
          onClose={close}
          onConfirm={async () => {
            const done =
              deleting.kind === 'income'
                ? await state.deleteIncome(deleting.item.id)
                : await state.deleteSource(deleting.item.id);
            if (done) close();
            else setAlert({ open: true, message: t('earnings.deleteFailed'), type: 'error' });
          }}
        />
      )}
    </div>
  );
};

export default Earnings_Register;
