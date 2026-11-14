import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrencyFormat } from '../../../../Hooks/useCurrencyFormat';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import type { Personal_Bank_Account } from '../../../../Hooks/Finances/usePersonalIncome';
import {
  DEBT_MOVEMENT_KINDS,
  type Debt_Due,
  type Debt_Movement,
  type Debt_Movement_Kind,
  type Personal_Debt,
} from '../../../../Hooks/Finances/usePersonalDebt';

interface Debt_Movement_Popover_Props {
  // Editar um movimento, pagar uma prestação por pagar, ou um movimento novo
  movement: Debt_Movement | null;
  due: Debt_Due | null;
  // A dívida escolhida à partida (o «+» de uma dívida)
  debtId?: string;
  dueLabel?: string;
  debts: Personal_Debt[];
  bankAccounts: Personal_Bank_Account[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => void;
}

const NONE = '';
const number = (value: string) => Number(value.replace(',', '.'));
const today = () => new Date().toISOString().slice(0, 10);
const text = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value));

/**
 * Um movimento de uma dívida: uma prestação (com os juros e os encargos à
 * parte, e o capital é o resto), uma amortização ou um aumento. Pagar uma
 * prestação por pagar já traz a dívida, o mês, o valor e os juros estimados.
 */
const Debt_Movement_Popover = ({
  movement,
  due,
  debtId: initialDebtId,
  dueLabel,
  debts,
  bankAccounts,
  saving,
  error,
  onClose,
  onSave,
}: Debt_Movement_Popover_Props) => {
  const { t } = useTranslation();
  const { formatIn } = useCurrencyFormat();
  const fixed = Boolean(movement || due);
  const [debtId, setDebtId] = useState(movement?.debtId ?? due?.debtId ?? initialDebtId ?? '');
  const [kind, setKind] = useState<Debt_Movement_Kind>(movement?.kind ?? 'installment');
  const [date, setDate] = useState(movement?.date ?? (due ? (due.date < today() ? due.date : today()) : today()));
  const [amount, setAmount] = useState(text(movement?.amount ?? due?.amount));
  const [interest, setInterest] = useState(text(movement?.interestPart ?? due?.interestEstimate));
  const [fees, setFees] = useState(text(movement?.feesPart));
  const [period, setPeriod] = useState(movement?.period ?? due?.period ?? '');
  const debt = debts.find((item) => item.id === debtId);
  const [bankAccountId, setBankAccountId] = useState(movement?.bankAccountId ?? debt?.bankAccountId ?? NONE);
  const [notes, setNotes] = useState(movement?.notes ?? '');

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const payment = kind !== 'charge';
  const value = number(amount);
  const principal = value - (interest ? number(interest) : 0) - (fees ? number(fees) : 0);
  const accounts = bankAccounts.filter(
    (account) => (account.status === 'active' || account.id === bankAccountId) && account.currencyId === debt?.currencyId,
  );
  const valid = Boolean(debt) && value > 0 && Boolean(date) && (!payment || principal >= 0);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const body: Record<string, unknown> = {
      date,
      amount: value,
      bankAccountId: bankAccountId || null,
      notes: notes.trim() || null,
    };
    if (payment) {
      const parts = Boolean(interest || fees);
      Object.assign(body, {
        interestPart: interest ? number(interest) : null,
        feesPart: fees ? number(fees) : null,
        principalPart: parts ? Math.round(principal * 100) / 100 : null,
        period: kind === 'installment' ? period || null : null,
      });
    }
    if (!movement) Object.assign(body, { debtId, kind });
    onSave(body);
  };

  const title = movement ? 'debts.movementEditTitle' : due ? 'debts.payTitle' : 'debts.movementAddTitle';

  return (
    <div className="Popover_Backdrop" onClick={onClose}>
      <form className="Popover_Card Narrow" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{t(title)}</span>
            <span className="Popover_Subtitle">
              {due ? dueLabel : movement ? `${movement.debt.name} · ${t(`debts.movement_${movement.kind}`)}` : t('debts.movementSubtitle')}
            </span>
          </div>
          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body Single_Column">
          {!fixed && (
            <>
              <div className="Form_Field">
                <label htmlFor="movement-debt">{t('debts.debt')} *</label>
                <Global_Dropdown
                  id="movement-debt"
                  value={debtId}
                  onChange={(next) => {
                    const chosen = debts.find((item) => item.id === String(next));
                    setDebtId(String(next));
                    setBankAccountId(chosen?.bankAccountId ?? NONE);
                    if (chosen?.installment && !amount) setAmount(String(chosen.installment));
                  }}
                  options={[
                    { value: '', label: t('debts.chooseDebt') },
                    ...debts
                      .filter((item) => item.status === 'active' || item.id === debtId)
                      .map((item) => ({ value: item.id, label: item.name })),
                  ]}
                />
              </div>
              <div className="Form_Field">
                <div className="Tabs">
                  {DEBT_MOVEMENT_KINDS.map((option) => (
                    <button key={option} type="button" className={kind === option ? 'Active' : ''} onClick={() => setKind(option)}>
                      {t(`debts.movement_${option}`)}
                    </button>
                  ))}
                </div>
                <span className="Field_Hint">{t(`debts.movementHint_${kind}`)}</span>
              </div>
            </>
          )}

          <div className="Form_Field">
            <label htmlFor="movement-amount">
              {t('earnings.amount')} *{debt ? ` (${debt.currency.shortCode})` : ''}
            </label>
            <Global_Input id="movement-amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          {payment && (
            <div className="Debt_Pair">
              <div className="Form_Field">
                <label htmlFor="movement-interest">{t('debts.interestPart')}</label>
                <Global_Input id="movement-interest" value={interest} onChange={(e) => setInterest(e.target.value)} />
              </div>
              <div className="Form_Field">
                <label htmlFor="movement-fees">{t('debts.feesPart')}</label>
                <Global_Input id="movement-fees" value={fees} onChange={(e) => setFees(e.target.value)} />
              </div>
              <span className={`Field_Hint Full_Width${principal < 0 ? ' Earnings_Error' : ''}`}>
                {value > 0 && debt
                  ? t('debts.principalHint', { amount: formatIn(Math.max(principal, 0), debt.currency.shortCode) })
                  : t('debts.partsHint')}
              </span>
            </div>
          )}
          <div className="Debt_Pair">
            <div className="Form_Field">
              <label htmlFor="movement-date">{t('earnings.date')} *</label>
              <Global_Input id="movement-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {kind === 'installment' && (
              <div className="Form_Field">
                <label htmlFor="movement-period">{t('debts.period')}</label>
                <Global_Input
                  id="movement-period"
                  type="month"
                  value={period}
                  disabled={Boolean(due)}
                  onChange={(e) => setPeriod(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="Form_Field">
            <label htmlFor="movement-account">{t('earnings.account')}</label>
            <Global_Dropdown
              id="movement-account"
              value={bankAccountId}
              onChange={(next) => setBankAccountId(String(next))}
              options={[
                { value: NONE, label: t('earnings.noAccount') },
                ...accounts.map((account) => ({ value: account.id, label: account.name })),
              ]}
            />
          </div>
          <div className="Form_Field">
            <label htmlFor="movement-notes">{t('debts.notes')}</label>
            <Global_Input id="movement-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && <span className="Field_Hint Earnings_Error">{error}</span>}
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
          </div>
          <div className="Form_Action">
            <Simple_Button
              type="submit"
              text={saving ? t('common.saving') : due ? t('debts.pay') : t('common.save')}
              disabled={saving || !valid}
            />
          </div>
        </div>
      </form>
    </div>
  );
};

export default Debt_Movement_Popover;
