import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import type { CompanyBankAccount } from '../../../../Hooks/Companies/useCompanyBankAccounts';
import type { Upcoming_Payment } from '../../../../Hooks/Companies/useUpcomingPayments';

export interface Member_Payment_Input {
  paymentDate: string;
  fromBankAccountId: string;
  amount: number;
  description: string;
}

interface Record_Member_Payment_Popover_Props {
  payment: Upcoming_Payment;
  label: string;
  bankAccounts: CompanyBankAccount[];
  companyCurrencyId: string;
  saving: boolean;
  onClose: () => void;
  onConfirm: (input: Member_Payment_Input) => void;
}

/**
 * Registar um salário, subsídio ou recibo verde como pago: a data, a conta de
 * onde saiu e o valor que saiu do banco — num salário o líquido (o bruto vem
 * proposto), num recibo verde o bruto menos a retenção. Só as contas na moeda
 * do pagamento ou na da empresa servem.
 */
const Record_Member_Payment_Popover = ({
  payment,
  label,
  bankAccounts,
  companyCurrencyId,
  saving,
  onClose,
  onConfirm,
}: Record_Member_Payment_Popover_Props) => {
  const { t } = useTranslation();
  const accounts = bankAccounts.filter(
    (account) =>
      account.status === 'active' &&
      (account.currencyId === payment.currency.id || account.currencyId === companyCurrencyId),
  );
  const [paymentDate, setPaymentDate] = useState(payment.date);
  const [accountId, setAccountId] = useState(
    accounts.find((account) => account.id === payment.bankAccountId)?.id ?? accounts[0]?.id ?? '',
  );
  const [amount, setAmount] = useState(String(payment.kind === 'freelance' ? payment.netAmount : payment.grossAmount));
  const [description, setDescription] = useState(`${label} · ${payment.memberName}`);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const value = Number(amount.replace(',', '.'));
  const valid = Boolean(paymentDate) && Boolean(accountId) && value > 0;

  return (
    <div className="Popover_Backdrop" onClick={onClose}>
      <form
        className="Popover_Card Narrow"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onConfirm({ paymentDate, fromBankAccountId: accountId, amount: value, description: description.trim() });
        }}
      >
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{t('upcomingPayments.recordTitle')}</span>
            <span className="Popover_Subtitle">
              {payment.memberName} · {label}
            </span>
          </div>
          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body Single_Column">
          <div className="Form_Field">
            <label htmlFor="record-date">{t('upcomingPayments.paymentDate')} *</label>
            <Global_Input id="record-date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div className="Form_Field">
            <label htmlFor="record-account">{t('upcomingPayments.account')} *</label>
            <Global_Dropdown
              id="record-account"
              value={accountId}
              onChange={(next) => setAccountId(String(next))}
              placeholder={t('upcomingPayments.noAccounts')}
              options={accounts.map((account) => ({ value: account.id, label: account.name }))}
            />
          </div>
          <div className="Form_Field">
            <label htmlFor="record-amount">
              {t('upcomingPayments.amount', { currency: payment.currency.shortCode })} *
            </label>
            <Global_Input id="record-amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <span className="Field_Hint">
              {t(payment.kind === 'freelance' ? 'upcomingPayments.amountFreelanceHint' : 'upcomingPayments.amountSalaryHint')}
            </span>
          </div>
          <div className="Form_Field">
            <label htmlFor="record-description">{t('upcomingPayments.description')}</label>
            <Global_Input id="record-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
          </div>
          <div className="Form_Action">
            <Simple_Button
              type="submit"
              text={saving ? t('common.saving') : t('upcomingPayments.record')}
              disabled={saving || !valid}
            />
          </div>
        </div>
      </form>
    </div>
  );
};

export default Record_Member_Payment_Popover;
