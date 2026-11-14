import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import { useCompanyBankAccounts } from '../../../../Hooks/Companies/useCompanyBankAccounts';
import type { Personal_Bank_Account } from '../../../../Hooks/Finances/usePersonalIncome';
import {
  EXPENSE_KINDS,
  type Expense_Category,
  type Expense_Kind,
  type Personal_Expense,
  type Personal_Product,
} from '../../../../Hooks/Finances/usePersonalExpense';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import * as Icon from '../../../../Imports/icons';
import { categoryOptions, categoryPath } from './expensesShared';

interface Expense_Popover_Props {
  expense: Personal_Expense | null;
  categories: Expense_Category[];
  itemCategories: Expense_Category[];
  products: Personal_Product[];
  companies: { id: string; name: string }[];
  bankAccounts: Personal_Bank_Account[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => void;
}

interface Line {
  key: string;
  productId: string;
  name: string;
  quantity: string;
  unitPrice: string;
}

const NONE = '';
const number = (value: string) => Number(value.replace(',', '.'));
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): Line => ({ key: crypto.randomUUID(), productId: '', name: '', quantity: '1', unitPrice: '' });

/**
 * Uma despesa: uma compra (a loja e as linhas — o produto, a quantidade, o
 * preço; o total é a soma, e a categoria do item é a do produto), dinheiro posto numa empresa (a
 * empresa e a conta dela onde entra: fica lá como recebimento do sócio) ou
 * outra (só o valor). Os produtos já comprados aparecem como sugestão.
 */
const Expense_Popover = ({
  expense,
  categories,
  itemCategories,
  products,
  companies,
  bankAccounts,
  saving,
  error,
  onClose,
  onSave,
}: Expense_Popover_Props) => {
  const { t } = useTranslation();
  const { currencies, selectedCurrency } = useCurrency();
  const { formatIn } = useCurrencyFormat();
  const [kind, setKind] = useState<Expense_Kind>(expense?.kind ?? 'purchase');
  const [date, setDate] = useState(expense?.date ?? today());
  const [merchant, setMerchant] = useState(expense?.merchant ?? '');
  const [description, setDescription] = useState(expense?.description ?? '');
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? NONE);
  const [companyId, setCompanyId] = useState(expense?.companyId ?? NONE);
  const [companyAccountId, setCompanyAccountId] = useState(NONE);
  const [amount, setAmount] = useState(expense && expense.items.length === 0 ? String(expense.amount) : '');
  const [currencyId, setCurrencyId] = useState(
    expense?.currencyId ?? currencies.find((currency) => currency.shortCode === selectedCurrency)?.id ?? '',
  );
  const [status, setStatus] = useState<'paid' | 'pending'>(expense?.status ?? 'paid');
  const [bankAccountId, setBankAccountId] = useState(expense?.bankAccountId ?? NONE);
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [lines, setLines] = useState<Line[]>(
    expense && expense.items.length > 0
      ? expense.items.map((item) => ({
          key: crypto.randomUUID(),
          productId: item.productId ?? '',
          name: item.name,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
        }))
      : expense
        ? []
        : [emptyLine()],
  );
  const { bankAccounts: companyAccounts } = useCompanyBankAccounts(kind === 'company' && companyId ? companyId : undefined);
  const lockedCompany = Boolean(expense?.companyPaymentId);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const code = currencies.find((currency) => currency.id === currencyId)?.shortCode ?? selectedCurrency;
  const filledLines = kind === 'purchase' ? lines.filter((line) => line.name.trim()) : [];
  const linesTotal = filledLines.reduce((sum, line) => sum + number(line.quantity || '0') * number(line.unitPrice || '0'), 0);
  const total = filledLines.length > 0 ? linesTotal : number(amount || '0');
  const linesValid = filledLines.every((line) => number(line.quantity) > 0 && number(line.unitPrice) >= 0);
  const valid =
    Boolean(date) &&
    Boolean(currencyId) &&
    total > 0 &&
    linesValid &&
    (kind !== 'company' || lockedCompany || (Boolean(companyId) && Boolean(companyAccountId)));

  const setLine = (key: string, patch: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  // Ao escrever o nome de um produto já conhecido, liga-o (e mostra a categoria dele)
  const setLineName = (key: string, name: string) => {
    const product = products.find((item) => item.name.toLowerCase() === name.trim().toLowerCase());
    setLines((current) =>
      current.map((line) =>
        line.key === key
          ? {
              ...line,
              name,
              productId: product?.id ?? '',
            }
          : line,
      ),
    );
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const body: Record<string, unknown> = {
      merchant: merchant.trim() || null,
      description: description.trim() || null,
      categoryId: categoryId || null,
      status,
      bankAccountId: bankAccountId || null,
      notes: notes.trim() || null,
    };
    // Numa entrada na empresa já gravada, o valor, a moeda e a data ficam
    if (!lockedCompany) {
      Object.assign(body, { date, currencyId });
      if (filledLines.length > 0) {
        body.items = filledLines.map((line) => ({
          ...(line.productId ? { productId: line.productId } : {}),
          name: line.name.trim(),
          quantity: number(line.quantity),
          unitPrice: number(line.unitPrice),
        }));
      } else {
        body.amount = number(amount);
        if (expense) body.items = [];
      }
    }
    if (!expense) {
      body.kind = kind;
      if (kind === 'company') Object.assign(body, { companyId, companyBankAccountId: companyAccountId });
    }
    onSave(body);
  };

  const accounts = bankAccounts.filter(
    (account) => (account.status === 'active' || account.id === bankAccountId) && account.currencyId === currencyId,
  );
  const options = categoryOptions(categories, t('expenses.noCategory'), categoryId);
  // A categoria do item vem do produto; um nome novo cria o item (categoriza-se na página Itens)
  const lineCategory = (line: Line) => {
    if (!line.name.trim()) return '';
    const product = products.find((item) => item.id === line.productId);
    if (!product) return t('expenses.newItem');
    return categoryPath(itemCategories, product.categoryId) ?? t('expenses.noCategory');
  };

  return (
    <div className="Popover_Backdrop" onClick={onClose}>
      <form className="Popover_Card Wide" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{t(expense ? 'expenses.editTitle' : 'expenses.addTitle')}</span>
            <span className="Popover_Subtitle">{t(`expenses.kind_${kind}Hint`)}</span>
          </div>
          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body Expense_Body">
          {!expense && (
            <div className="Form_Field Expense_Full">
              <div className="Tabs">
                {EXPENSE_KINDS.map((option) => (
                  <button key={option} type="button" className={kind === option ? 'Active' : ''} onClick={() => setKind(option)}>
                    {t(`expenses.kind_${option}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {lockedCompany && <span className="Field_Hint Expense_Full">{t('expenses.companyLocked')}</span>}

          <div className="Form_Field">
            <label htmlFor="expense-date">{t('expenses.date')} *</label>
            <Global_Input id="expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={lockedCompany} />
          </div>
          <div className="Form_Field">
            <label htmlFor="expense-currency">{t('expenses.currency')} *</label>
            <Global_Dropdown
              id="expense-currency"
              value={currencyId}
              onChange={(value) => {
                setCurrencyId(String(value));
                setBankAccountId(NONE);
              }}
              options={currencies.map((currency) => ({ value: currency.id, label: `${currency.shortCode} · ${currency.name}` }))}
            />
          </div>

          {kind === 'company' ? (
            <>
              <div className="Form_Field">
                <label htmlFor="expense-company">{t('expenses.company')} *</label>
                {expense ? (
                  <Global_Input id="expense-company" value={expense.company?.name ?? ''} disabled />
                ) : (
                  <Global_Dropdown
                    id="expense-company"
                    value={companyId}
                    onChange={(value) => {
                      setCompanyId(String(value));
                      setCompanyAccountId(NONE);
                    }}
                    placeholder={t('expenses.chooseCompany')}
                    options={companies.map((company) => ({ value: company.id, label: company.name }))}
                  />
                )}
              </div>
              {!expense && (
                <div className="Form_Field">
                  <label htmlFor="expense-company-account">{t('expenses.companyAccount')} *</label>
                  <Global_Dropdown
                    id="expense-company-account"
                    value={companyAccountId}
                    onChange={(value) => setCompanyAccountId(String(value))}
                    placeholder={t('expenses.chooseCompanyAccount')}
                    options={companyAccounts
                      .filter((account) => account.status === 'active')
                      .map((account) => ({ value: account.id, label: account.name }))}
                  />
                  <span className="Field_Hint">{t('expenses.companyAccountHint')}</span>
                </div>
              )}
            </>
          ) : (
            <div className="Form_Field">
              <label htmlFor="expense-merchant">{t('expenses.merchant')}</label>
              <Global_Input id="expense-merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
            </div>
          )}

          <div className="Form_Field">
            <label htmlFor="expense-category">{t('expenses.category')}</label>
            <Global_Dropdown id="expense-category" value={categoryId} onChange={(value) => setCategoryId(String(value))} options={options} />
          </div>

          <div className="Form_Field">
            <label htmlFor="expense-description">{t('expenses.description')}</label>
            <Global_Input id="expense-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {(kind !== 'purchase' || filledLines.length === 0) && (
            <div className="Form_Field">
              <label htmlFor="expense-amount">{t('expenses.amount', { currency: code })} *</label>
              <Global_Input
                id="expense-amount"
                value={filledLines.length > 0 ? String(linesTotal) : amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={lockedCompany}
              />
              {kind === 'purchase' && <span className="Field_Hint">{t('expenses.amountHint')}</span>}
            </div>
          )}

          {kind === 'purchase' && !lockedCompany && (
            <div className="Expense_Full Expense_Lines">
              <div className="Expense_Line Expense_Line_Head">
                <span>{t('expenses.product')}</span>
                <span>{t('expenses.quantity')}</span>
                <span>{t('expenses.unitPrice')}</span>
                <span>{t('expenses.itemCategory')}</span>
                <span className="Right">{t('expenses.lineTotal')}</span>
                <span />
              </div>
              {lines.map((line) => (
                <div key={line.key} className="Expense_Line">
                  <Global_Input
                    id={`line-name-${line.key}`}
                    list="expense-products"
                    value={line.name}
                    onChange={(e) => setLineName(line.key, e.target.value)}
                    placeholder={t('expenses.productPlaceholder')}
                  />
                  <Global_Input id={`line-qty-${line.key}`} value={line.quantity} onChange={(e) => setLine(line.key, { quantity: e.target.value })} />
                  <Global_Input id={`line-price-${line.key}`} value={line.unitPrice} onChange={(e) => setLine(line.key, { unitPrice: e.target.value })} />
                  <span className="Expense_Line_Category">{lineCategory(line)}</span>
                  <span className="Right Num">
                    {formatIn(number(line.quantity || '0') * number(line.unitPrice || '0'), code)}
                  </span>
                  <button
                    type="button"
                    className="Icon_Button Tiny"
                    aria-label={t('common.delete')}
                    onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                  >
                    <Icon.Trash />
                  </button>
                </div>
              ))}
              <datalist id="expense-products">
                {products.map((product) => (
                  <option key={product.id} value={product.name} />
                ))}
              </datalist>
              <div className="Expense_Lines_Foot">
                <button type="button" className="Earnings_Link" onClick={() => setLines((current) => [...current, emptyLine()])}>
                  + {t('expenses.addLine')}
                </button>
                {filledLines.length > 0 && (
                  <span className="Num Expense_Total">{t('expenses.total', { total: formatIn(linesTotal, code) })}</span>
                )}
              </div>
            </div>
          )}

          <div className="Form_Field">
            <label>{t('expenses.status')}</label>
            <div className="Tabs">
              {(['paid', 'pending'] as const).map((option) => (
                <button key={option} type="button" className={status === option ? 'Active' : ''} onClick={() => setStatus(option)}>
                  {t(`expenses.status_${option}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="Form_Field">
            <label htmlFor="expense-account">{t('expenses.account')}</label>
            <Global_Dropdown
              id="expense-account"
              value={bankAccountId}
              onChange={(value) => setBankAccountId(String(value))}
              options={[
                { value: NONE, label: t('expenses.noAccount') },
                ...accounts.map((account) => ({ value: account.id, label: account.name })),
              ]}
            />
          </div>
          <div className="Form_Field Expense_Full">
            <label htmlFor="expense-notes">{t('expenses.notes')}</label>
            <Global_Input id="expense-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && <span className="Field_Hint Earnings_Error Expense_Full">{error}</span>}
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
          </div>
          <div className="Form_Action">
            <Simple_Button type="submit" text={saving ? t('common.saving') : t('common.save')} disabled={saving || !valid} />
          </div>
        </div>
      </form>
    </div>
  );
};

export default Expense_Popover;
