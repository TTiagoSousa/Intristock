import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import type { Personal_Bank_Account } from '../../../../Hooks/Finances/usePersonalIncome';
import {
  SUBSCRIPTION_KINDS,
  SUBSCRIPTION_STATUSES,
  type Expense_Category,
  type Personal_Subscription,
  type Subscription_Kind,
  type Subscription_Status,
} from '../../../../Hooks/Finances/usePersonalExpense';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import { categoryOptions } from './expensesShared';

interface Subscription_Popover_Props {
  subscription: Personal_Subscription | null;
  categories: Expense_Category[];
  bankAccounts: Personal_Bank_Account[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => void;
}

// De quanto em quanto tempo cobra (meses)
const SUBSCRIPTION_INTERVALS = [1, 3, 6, 12] as const;

const NONE = '';
const number = (value: string) => Number(value.replace(',', '.'));
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Uma subscrição: o nome, quem cobra, o valor e a moeda; recorrente (de quanto
 * em quanto tempo e em que dia do mês) ou um só pagamento; de quando a quando,
 * o estado, a categoria das despesas que grava e a conta de onde sai.
 */
const Subscription_Popover = ({ subscription, categories, bankAccounts, saving, error, onClose, onSave }: Subscription_Popover_Props) => {
  const { t } = useTranslation();
  const { currencies, selectedCurrency } = useCurrency();
  const [kind, setKind] = useState<Subscription_Kind>(subscription?.kind ?? 'video');
  const [name, setName] = useState(subscription?.name ?? '');
  const [merchant, setMerchant] = useState(subscription?.merchant ?? '');
  const [amount, setAmount] = useState(subscription ? String(subscription.amount) : '');
  const [currencyId, setCurrencyId] = useState(
    subscription?.currencyId ?? currencies.find((currency) => currency.shortCode === selectedCurrency)?.id ?? '',
  );
  const [recurring, setRecurring] = useState(subscription?.recurring ?? true);
  const [intervalMonths, setIntervalMonths] = useState(subscription?.intervalMonths ?? 1);
  const [billingDay, setBillingDay] = useState(subscription?.billingDay ? String(subscription.billingDay) : '');
  const [startDate, setStartDate] = useState(subscription?.startDate ?? today());
  const [endDate, setEndDate] = useState(subscription?.endDate ?? '');
  const [status, setStatus] = useState<Subscription_Status>(subscription?.status ?? 'active');
  const [categoryId, setCategoryId] = useState(subscription?.categoryId ?? NONE);
  const [bankAccountId, setBankAccountId] = useState(subscription?.bankAccountId ?? NONE);
  const [notes, setNotes] = useState(subscription?.notes ?? '');

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const code = currencies.find((currency) => currency.id === currencyId)?.shortCode ?? selectedCurrency;
  const day = number(billingDay);
  const validDay = !billingDay || (Number.isInteger(day) && day >= 1 && day <= 31);
  const valid =
    Boolean(name.trim()) &&
    number(amount || '0') > 0 &&
    Boolean(currencyId) &&
    Boolean(startDate) &&
    validDay &&
    (!endDate || endDate >= startDate);
  const accounts = bankAccounts.filter(
    (account) => (account.status === 'active' || account.id === bankAccountId) && account.currencyId === currencyId,
  );

  return (
    <div className="Popover_Backdrop" onClick={onClose}>
      <form
        className="Popover_Card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onSave({
            kind,
            name: name.trim(),
            merchant: merchant.trim() || null,
            amount: number(amount),
            currencyId,
            recurring,
            intervalMonths: recurring ? intervalMonths : 1,
            billingDay: recurring && billingDay ? day : null,
            startDate,
            endDate: endDate || null,
            status,
            categoryId: categoryId || null,
            bankAccountId: bankAccountId || null,
            notes: notes.trim() || null,
          });
        }}
      >
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{t(subscription ? 'subscriptions.editTitle' : 'subscriptions.addTitle')}</span>
            <span className="Popover_Subtitle">{t(recurring ? 'subscriptions.recurringHint' : 'subscriptions.onceHint')}</span>
          </div>
          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body Expense_Body">
          <div className="Form_Field Expense_Full">
            <div className="Tabs">
              {([true, false] as const).map((option) => (
                <button key={String(option)} type="button" className={recurring === option ? 'Active' : ''} onClick={() => setRecurring(option)}>
                  {t(option ? 'subscriptions.recurring' : 'subscriptions.once')}
                </button>
              ))}
            </div>
          </div>

          <div className="Form_Field">
            <label htmlFor="subscription-name">{t('subscriptions.name')} *</label>
            <Global_Input id="subscription-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('subscriptions.namePlaceholder')} />
          </div>
          <div className="Form_Field">
            <label htmlFor="subscription-kind">{t('subscriptions.kind')}</label>
            <Global_Dropdown
              id="subscription-kind"
              value={kind}
              onChange={(value) => setKind(String(value) as Subscription_Kind)}
              options={SUBSCRIPTION_KINDS.map((option) => ({ value: option, label: t(`subscriptions.kind_${option}`) }))}
            />
          </div>
          <div className="Form_Field">
            <label htmlFor="subscription-merchant">{t('subscriptions.merchant')}</label>
            <Global_Input id="subscription-merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder={t('subscriptions.merchantPlaceholder')} />
          </div>
          <div className="Form_Field">
            <label htmlFor="subscription-currency">{t('expenses.currency')} *</label>
            <Global_Dropdown
              id="subscription-currency"
              value={currencyId}
              onChange={(value) => {
                setCurrencyId(String(value));
                setBankAccountId(NONE);
              }}
              options={currencies.map((currency) => ({ value: currency.id, label: `${currency.shortCode} · ${currency.name}` }))}
            />
          </div>
          <div className="Form_Field">
            <label htmlFor="subscription-amount">{t(recurring ? 'subscriptions.amountEach' : 'subscriptions.amountOnce', { currency: code })} *</label>
            <Global_Input id="subscription-amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          {recurring ? (
            <div className="Form_Field">
              <label htmlFor="subscription-interval">{t('subscriptions.interval')}</label>
              <Global_Dropdown
                id="subscription-interval"
                value={intervalMonths}
                onChange={(value) => setIntervalMonths(Number(value))}
                options={[
                  ...SUBSCRIPTION_INTERVALS.map((option) => ({ value: option, label: t(`subscriptions.every_${option}`) })),
                  ...((SUBSCRIPTION_INTERVALS as readonly number[]).includes(intervalMonths)
                    ? []
                    : [{ value: intervalMonths, label: t('subscriptions.everyMonths', { count: intervalMonths }) }]),
                ]}
              />
            </div>
          ) : (
            <div className="Form_Field" />
          )}
          <div className="Form_Field">
            <label htmlFor="subscription-start">{t(recurring ? 'subscriptions.startDate' : 'subscriptions.paidOn')} *</label>
            <Global_Input id="subscription-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="Form_Field">
            <label htmlFor="subscription-end">{t(recurring ? 'subscriptions.endDate' : 'subscriptions.coversUntil')}</label>
            <Global_Input id="subscription-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            {recurring && <span className="Field_Hint">{t('subscriptions.endDateHint')}</span>}
          </div>
          {recurring && (
            <div className="Form_Field">
              <label htmlFor="subscription-day">{t('subscriptions.billingDay')}</label>
              <Global_Input id="subscription-day" value={billingDay} onChange={(e) => setBillingDay(e.target.value)} placeholder={startDate.slice(8, 10)} />
              <span className="Field_Hint">{t('subscriptions.billingDayHint')}</span>
            </div>
          )}
          <div className="Form_Field">
            <label>{t('subscriptions.status')}</label>
            <div className="Tabs">
              {SUBSCRIPTION_STATUSES.map((option) => (
                <button key={option} type="button" className={status === option ? 'Active' : ''} onClick={() => setStatus(option)}>
                  {t(`subscriptions.status_${option}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="Form_Field">
            <label htmlFor="subscription-category">{t('expenses.category')}</label>
            <Global_Dropdown
              id="subscription-category"
              value={categoryId}
              onChange={(value) => setCategoryId(String(value))}
              options={categoryOptions(categories, t('expenses.noCategory'), categoryId)}
            />
          </div>
          <div className="Form_Field">
            <label htmlFor="subscription-account">{t('expenses.account')}</label>
            <Global_Dropdown
              id="subscription-account"
              value={bankAccountId}
              onChange={(value) => setBankAccountId(String(value))}
              options={[
                { value: NONE, label: t('expenses.noAccount') },
                ...accounts.map((account) => ({ value: account.id, label: account.name })),
              ]}
            />
          </div>
          <div className="Form_Field Expense_Full">
            <label htmlFor="subscription-notes">{t('expenses.notes')}</label>
            <Global_Input id="subscription-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
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

export default Subscription_Popover;
