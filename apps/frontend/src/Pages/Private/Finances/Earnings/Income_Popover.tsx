import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import {
  INCOME_KINDS,
  type Expected_Income,
  type Income_Kind,
  type Income_Source,
  type Personal_Bank_Account,
  type Personal_Income,
} from '../../../../Hooks/Finances/usePersonalIncome';
import { localToday } from '../../../../utils/dates';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';

interface Income_Popover_Props {
  // Editar um registado, receber um esperado, ou nenhum dos dois: um ganho novo
  income: Personal_Income | null;
  expected: Expected_Income | null;
  // O nome do esperado ("Salário de novembro · Loja do Bairro")
  expectedLabel?: string;
  sources: Income_Source[];
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

/**
 * Um ganho: novo (o tipo, a fonte se houver, o valor, a data e se já entrou),
 * editado, ou um salário esperado a marcar como recebido — aí a origem e o
 * período vêm dele e propõe-se o valor e a data.
 */
const Income_Popover = ({
  income,
  expected,
  expectedLabel,
  sources,
  bankAccounts,
  saving,
  error,
  onClose,
  onSave,
}: Income_Popover_Props) => {
  const { t } = useTranslation();
  const groupId = useId();
  const { currencies, selectedCurrency } = useCurrency();
  const fixedOrigin = Boolean(income || expected);
  const [kind, setKind] = useState<Income_Kind>(income?.kind ?? expected?.kind ?? 'salary');
  const [sourceId, setSourceId] = useState(income?.sourceId ?? NONE);
  const [amount, setAmount] = useState(text(income?.amount ?? expected?.amount));
  const [grossAmount, setGrossAmount] = useState(text(income?.grossAmount ?? expected?.grossAmount));
  const [withholding, setWithholding] = useState(text(income?.withholdingPct ?? expected?.withholdingPct));
  const [currencyId, setCurrencyId] = useState(
    income?.currencyId ??
      expected?.currency.id ??
      currencies.find((currency) => currency.shortCode === selectedCurrency)?.id ??
      '',
  );
  // Um esperado recebe-se no dia dele, ou hoje se ainda não chegou
  const [date, setDate] = useState(
    income?.date ?? (expected ? (expected.date < today() ? expected.date : today()) : today()),
  );
  const [status, setStatus] = useState<'received' | 'pending'>(income?.status ?? 'received');
  const [bankAccountId, setBankAccountId] = useState(income?.bankAccountId ?? NONE);
  const [description, setDescription] = useState(income?.description ?? expected?.description ?? '');

  // As fontes do tipo escolhido (um salário vem de um empregador, um recibo de um cliente…)
  const sourceKindOf: Record<Income_Kind, string> = {
    salary: 'employer',
    freelance: 'client',
    lottery: 'lottery',
    other: 'other',
  };
  const kindSources = sources.filter(
    (source) => (source.isActive || source.id === sourceId) && source.kind === sourceKindOf[kind],
  );
  const accounts = bankAccounts.filter(
    (account) => (account.status === 'active' || account.id === bankAccountId) && account.currencyId === currencyId,
  );

  const value = number(amount);
  const valid = value > 0 && Boolean(currencyId) && Boolean(date);
  const showGross = kind === 'salary' || kind === 'freelance';

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const gross = number(grossAmount);
    const body: Record<string, unknown> = {
      amount: value,
      grossAmount: showGross && gross > 0 ? gross : null,
      withholdingPct: kind === 'freelance' && withholding ? number(withholding) : null,
      currencyId,
      date,
      status,
      bankAccountId: bankAccountId || null,
      description: description.trim() || null,
    };
    if (!income && expected) {
      Object.assign(body, {
        period: expected.period,
        ...(expected.memberPayId ? { memberPayId: expected.memberPayId } : { sourceId: expected.sourceId }),
      });
    } else if (!income) {
      Object.assign(body, { kind, ...(sourceId ? { sourceId } : {}) });
    }
    onSave(body);
  };

  const title = income ? 'earnings.incomeEditTitle' : expected ? 'earnings.receiveTitle' : 'earnings.incomeAddTitle';

  return (
    <Popover_Shell onClose={onClose} as="form" className="Narrow" onSubmit={submit}>
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{t(title)}</span>
          <span className="Popover_Subtitle">
            {expected ? expectedLabel : income ? t(`earnings.kind_${income.kind}`) : t('earnings.incomeSubtitle')}
          </span>
        </div>
        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>

      <div className="Popover_Body Single_Column">
        {!fixedOrigin && (
          <>
            <div className="Form_Field">
              <div className="Tabs">
                {INCOME_KINDS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={kind === option ? 'Active' : ''} aria-pressed={kind === option}
                    onClick={() => {
                      setKind(option);
                      setSourceId(NONE);
                    }}
                  >
                    {t(`earnings.kind_${option}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="Form_Field">
              <label htmlFor="income-source">{t('earnings.source')}</label>
              <Global_Dropdown
                id="income-source"
                value={sourceId}
                onChange={(next) => setSourceId(String(next))}
                options={[
                  { value: NONE, label: t('earnings.noSource') },
                  ...kindSources.map((source) => ({ value: source.id, label: source.name })),
                ]}
              />
            </div>
          </>
        )}

        {expected?.companyPaid && <span className="Field_Hint">{t('earnings.companyPaidHint')}</span>}

        <div className="Form_Field">
          <label htmlFor="income-currency">{t('earnings.currency')} *</label>
          <Global_Dropdown
            id="income-currency"
            value={currencyId}
            onChange={(next) => {
              setCurrencyId(String(next));
              setBankAccountId(NONE);
            }}
            options={currencies.map((currency) => ({
              value: currency.id,
              label: `${currency.shortCode} · ${currency.name}`,
            }))}
          />
        </div>
        <div className="Form_Field">
          <label htmlFor="income-amount">{t('earnings.amount')} *</label>
          <Global_Input id="income-amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <span className="Field_Hint">{t('earnings.amountHint')}</span>
        </div>
        {showGross && (
          <div className="Form_Field">
            <label htmlFor="income-gross">{t('earnings.grossAmount')}</label>
            <Global_Input id="income-gross" value={grossAmount} onChange={(e) => setGrossAmount(e.target.value)} />
          </div>
        )}
        {kind === 'freelance' && (
          <div className="Form_Field">
            <label htmlFor="income-withholding">{t('earnings.withholding')}</label>
            <Global_Input id="income-withholding" value={withholding} onChange={(e) => setWithholding(e.target.value)} />
          </div>
        )}
        <div className="Form_Field">
          <label htmlFor="income-date">{t('earnings.date')} *</label>
          <Global_Input id="income-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="Form_Field">
          <label id={`${groupId}-status`}>{t('earnings.status')}</label>
          <div className="Tabs" role="group" aria-labelledby={`${groupId}-status`}>
            {(['received', 'pending'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={status === option ? 'Active' : ''} aria-pressed={status === option}
                onClick={() => setStatus(option)}
              >
                {t(`earnings.status_${option}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="Form_Field">
          <label htmlFor="income-account">{t('earnings.account')}</label>
          <Global_Dropdown
            id="income-account"
            value={bankAccountId}
            onChange={(next) => setBankAccountId(String(next))}
            options={[
              { value: NONE, label: t('earnings.noAccount') },
              ...accounts.map((account) => ({ value: account.id, label: account.name })),
            ]}
          />
        </div>
        <div className="Form_Field">
          <label htmlFor="income-description">{t('earnings.description')}</label>
          <Global_Input id="income-description" value={description} onChange={(e) => setDescription(e.target.value)} />
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
            text={expected ? t('earnings.receive') : t('common.save')}
            disabled={saving || !valid}
          />
        </div>
      </div>
    </Popover_Shell>
  );
};

export default Income_Popover;
