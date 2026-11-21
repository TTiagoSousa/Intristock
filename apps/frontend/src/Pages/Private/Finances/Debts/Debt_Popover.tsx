import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import type { Personal_Bank_Account } from '../../../../Hooks/Finances/usePersonalIncome';
import {
  DEBT_KINDS,
  type Debt_Bank,
  type Debt_Direction,
  type Debt_Kind,
  type Debt_Status,
  type Personal_Debt,
} from '../../../../Hooks/Finances/usePersonalDebt';
import { localToday } from '../../../../utils/dates';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';

interface Debt_Popover_Props {
  debt: Personal_Debt | null;
  banks: Debt_Bank[];
  bankAccounts: Personal_Bank_Account[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => void;
}

const NONE = '';
const number = (value: string) => Number(value.replace(',', '.'));
// O dia de hoje no browser (o toISOString dava o de UTC: depois da meia-noite no verão, a véspera)
const today = localToday;
const text = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value));

// Os tipos que costumam ser de um banco (os outros escondem o banco da base)
const BANK_KINDS: Debt_Kind[] = ['mortgage', 'car', 'personal', 'credit_card', 'student', 'consumer'];

/**
 * Uma dívida: o que se deve ou o que devem, o tipo, a quem, o montante e, se se
 * quiser, o plano (taxa, prestação, dia e fim). Uma dívida que já vem de trás
 * («já a pagar») regista-se com o que falta e a data desse valor.
 */
const Debt_Popover = ({ debt, banks, bankAccounts, saving, error, onClose, onSave }: Debt_Popover_Props) => {
  const { t } = useTranslation();
  const groupId = useId();
  const { currencies, selectedCurrency } = useCurrency();
  const [direction, setDirection] = useState<Debt_Direction>(debt?.direction ?? 'owe');
  const [kind, setKind] = useState<Debt_Kind>(debt?.kind ?? 'mortgage');
  const [name, setName] = useState(debt?.name ?? '');
  const [counterparty, setCounterparty] = useState(debt?.counterparty ?? '');
  const [platformId, setPlatformId] = useState(debt?.platformId ?? NONE);
  const [currencyId, setCurrencyId] = useState(
    debt?.currencyId ?? currencies.find((currency) => currency.shortCode === selectedCurrency)?.id ?? '',
  );
  const [principal, setPrincipal] = useState(text(debt?.principal));
  // Já a pagar: entra com o que falta, não com o montante todo
  const [ongoing, setOngoing] = useState(Boolean(debt && debt.openingBalance !== debt.principal));
  const [openingBalance, setOpeningBalance] = useState(text(debt?.openingBalance));
  const [openingDate, setOpeningDate] = useState(debt?.openingDate ?? today());
  const [startDate, setStartDate] = useState(debt?.startDate ?? today());
  const [endDate, setEndDate] = useState(debt?.endDate ?? '');
  const [interestRate, setInterestRate] = useState(text(debt?.interestRate));
  const [rateType, setRateType] = useState<'fixed' | 'variable' | ''>(debt?.rateType ?? '');
  const [installment, setInstallment] = useState(text(debt?.installment));
  const [paymentDay, setPaymentDay] = useState(text(debt?.paymentDay));
  const [bankAccountId, setBankAccountId] = useState(debt?.bankAccountId ?? NONE);
  const [status, setStatus] = useState<Debt_Status>(debt?.status ?? 'active');
  const [notes, setNotes] = useState(debt?.notes ?? '');

  const accounts = bankAccounts.filter(
    (account) => (account.status === 'active' || account.id === bankAccountId) && account.currencyId === currencyId,
  );
  const day = paymentDay ? Number(paymentDay) : null;
  const valid =
    Boolean(name.trim()) &&
    Boolean(currencyId) &&
    number(principal) > 0 &&
    Boolean(startDate) &&
    (!ongoing || (openingBalance !== '' && number(openingBalance) >= 0 && Boolean(openingDate))) &&
    (day === null || (Number.isInteger(day) && day >= 1 && day <= 31)) &&
    (!endDate || endDate >= startDate);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const rate = interestRate ? number(interestRate) : null;
    const body: Record<string, unknown> = {
      direction,
      kind,
      name: name.trim(),
      counterparty: counterparty.trim() || null,
      platformId: BANK_KINDS.includes(kind) ? platformId || null : null,
      currencyId,
      principal: number(principal),
      startDate,
      endDate: endDate || null,
      interestRate: rate,
      rateType: rate === null ? null : rateType || null,
      installment: installment ? number(installment) : null,
      paymentDay: day,
      bankAccountId: bankAccountId || null,
      notes: notes.trim() || null,
    };
    // Sem «já a pagar», o que falta é o montante todo desde o início
    if (ongoing) Object.assign(body, { openingBalance: number(openingBalance), openingDate });
    else if (debt) Object.assign(body, { openingBalance: number(principal), openingDate: startDate });
    if (debt) body.status = status;
    onSave(body);
  };

  return (
    <Popover_Shell onClose={onClose} as="form" onSubmit={submit}>
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{t(debt ? 'debts.editTitle' : 'debts.addTitle')}</span>
          <span className="Popover_Subtitle">{t('debts.formSubtitle')}</span>
        </div>
        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>

      <div className="Popover_Body">
        <div className="Form_Field">
          <div className="Tabs">
            {(['owe', 'lent'] as const).map((option) => (
              <button key={option} type="button" className={direction === option ? 'Active' : ''} aria-pressed={direction === option} onClick={() => setDirection(option)}>
                {t(`debts.direction_${option}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="Debt_Pair">
          <div className="Form_Field">
            <label htmlFor="debt-kind">{t('debts.kind')} *</label>
            <Global_Dropdown
              id="debt-kind"
              value={kind}
              onChange={(next) => setKind(next as Debt_Kind)}
              options={DEBT_KINDS.map((option) => ({ value: option, label: t(`debts.kind_${option}`) }))}
            />
          </div>
          <div className="Form_Field">
            <label htmlFor="debt-name">{t('debts.name')} *</label>
            <Global_Input
              id="debt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('debts.namePlaceholder')}
            />
          </div>
        </div>

        <div className="Debt_Pair">
          <div className="Form_Field">
            <label htmlFor="debt-counterparty">{t(direction === 'owe' ? 'debts.lender' : 'debts.borrower')}</label>
            <Global_Input
              id="debt-counterparty"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder={t('debts.counterpartyPlaceholder')}
            />
          </div>
          {BANK_KINDS.includes(kind) && (
            <div className="Form_Field">
              <label htmlFor="debt-bank">{t('debts.bank')}</label>
              <Global_Dropdown
                id="debt-bank"
                value={platformId}
                onChange={(next) => setPlatformId(String(next))}
                options={[{ value: NONE, label: t('debts.noBank') }, ...banks.map((bank) => ({ value: bank.id, label: bank.name }))]}
              />
            </div>
          )}
        </div>

        <div className="Debt_Pair">
          <div className="Form_Field">
            <label htmlFor="debt-currency">{t('earnings.currency')} *</label>
            <Global_Dropdown
              id="debt-currency"
              value={currencyId}
              onChange={(next) => {
                setCurrencyId(String(next));
                setBankAccountId(NONE);
              }}
              options={currencies.map((currency) => ({ value: currency.id, label: `${currency.shortCode} · ${currency.name}` }))}
            />
          </div>
          <div className="Form_Field">
            <label htmlFor="debt-principal">{t(kind === 'credit_card' ? 'debts.limit' : 'debts.principal')} *</label>
            <Global_Input id="debt-principal" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          </div>
        </div>

        <div className="Debt_Pair">
          <div className="Form_Field">
            <label htmlFor="debt-start">{t('debts.startDate')} *</label>
            <Global_Input id="debt-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="Form_Field">
            <label htmlFor="debt-end">{t('debts.endDate')}</label>
            <Global_Input id="debt-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <label className="Debt_Check">
          <input type="checkbox" checked={ongoing} onChange={(e) => setOngoing(e.target.checked)} />
          <span>{t('debts.ongoing')}</span>
        </label>
        {ongoing && (
          <div className="Debt_Pair">
            <div className="Form_Field">
              <label htmlFor="debt-opening">{t('debts.openingBalance')} *</label>
              <Global_Input id="debt-opening" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
            </div>
            <div className="Form_Field">
              <label htmlFor="debt-opening-date">{t('debts.openingDate')} *</label>
              <Global_Input id="debt-opening-date" type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />
            </div>
            <span className="Field_Hint Full_Width">{t('debts.ongoingHint')}</span>
          </div>
        )}

        <span className="Debt_Section">{t('debts.planTitle')}</span>
        <div className="Debt_Pair">
          <div className="Form_Field">
            <label htmlFor="debt-installment">{t('debts.installment')}</label>
            <Global_Input id="debt-installment" value={installment} onChange={(e) => setInstallment(e.target.value)} />
          </div>
          <div className="Form_Field">
            <label htmlFor="debt-day">{t('debts.paymentDay')}</label>
            <Global_Input id="debt-day" value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)} />
          </div>
          <div className="Form_Field">
            <label htmlFor="debt-rate">{t('debts.interestRate')}</label>
            <Global_Input id="debt-rate" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
          </div>
          <div className="Form_Field">
            <label id={`${groupId}-rateType`}>{t('debts.rateType')}</label>
            <div className="Tabs" role="group" aria-labelledby={`${groupId}-rateType`}>
              {(['fixed', 'variable'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={rateType === option ? 'Active' : ''} aria-pressed={rateType === option}
                  onClick={() => setRateType(rateType === option ? '' : option)}
                >
                  {t(`debts.rate_${option}`)}
                </button>
              ))}
            </div>
          </div>
          <span className="Field_Hint Full_Width">{t('debts.planHint')}</span>
        </div>

        <div className="Debt_Pair">
          <div className="Form_Field">
            <label htmlFor="debt-account">{t(direction === 'owe' ? 'debts.accountFrom' : 'debts.accountTo')}</label>
            <Global_Dropdown
              id="debt-account"
              value={bankAccountId}
              onChange={(next) => setBankAccountId(String(next))}
              options={[
                { value: NONE, label: t('earnings.noAccount') },
                ...accounts.map((account) => ({ value: account.id, label: account.name })),
              ]}
            />
          </div>
          {debt && (
            <div className="Form_Field">
              <label id={`${groupId}-status`}>{t('debts.status')}</label>
              <div className="Tabs" role="group" aria-labelledby={`${groupId}-status`}>
                {(['active', 'paid_off', 'closed'] as const).map((option) => (
                  <button key={option} type="button" className={status === option ? 'Active' : ''} aria-pressed={status === option} onClick={() => setStatus(option)}>
                    {t(`debts.status_${option}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="Form_Field">
          <label htmlFor="debt-notes">{t('debts.notes')}</label>
          <Global_Input id="debt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && <span className="Field_Hint Earnings_Error">{error}</span>}
      </div>

      <div className="Popover_Footer">
        <div className="Form_Action">
          <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
        </div>
        <div className="Form_Action">
          <Simple_Button type="submit" text={t('common.save')} disabled={saving || !valid} />
        </div>
      </div>
    </Popover_Shell>
  );
};

export default Debt_Popover;
