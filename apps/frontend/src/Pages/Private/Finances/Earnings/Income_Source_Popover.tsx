import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import {
  INCOME_SOURCE_KINDS,
  type Income_Source,
  type Income_Source_Kind,
} from '../../../../Hooks/Finances/usePersonalIncome';
import { localToday } from '../../../../utils/dates';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';

interface Income_Source_Popover_Props {
  source: Income_Source | null;
  companies: { id: string; name: string }[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => void;
}

const NO_COMPANY = '';
const number = (value: string) => Number(value.replace(',', '.'));

/**
 * Criar ou editar uma fonte de ganhos: o tipo (empregador, cliente, raspadinhas,
 * outro), o nome, a empresa da base a que se liga (opcional) e, num empregador
 * ou cliente fixo, o salário — com ele, cada mês aparece como um ganho esperado.
 */
const Income_Source_Popover = ({ source, companies, saving, error, onClose, onSave }: Income_Source_Popover_Props) => {
  const { t } = useTranslation();
  const { currencies, selectedCurrency } = useCurrency();
  const [kind, setKind] = useState<Income_Source_Kind>(source?.kind ?? 'employer');
  const [name, setName] = useState(source?.name ?? '');
  const [companyId, setCompanyId] = useState(source?.companyId ?? NO_COMPANY);
  // O salário fixo: ligado se já o tiver
  const [hasSalary, setHasSalary] = useState(Boolean(source?.payDay));
  const [grossAmount, setGrossAmount] = useState(source?.grossAmount ? String(source.grossAmount) : '');
  const [netAmount, setNetAmount] = useState(source?.netAmount ? String(source.netAmount) : '');
  const [currencyId, setCurrencyId] = useState(
    source?.currencyId ?? currencies.find((currency) => currency.shortCode === selectedCurrency)?.id ?? '',
  );
  const [payDay, setPayDay] = useState(String(source?.payDay ?? 28));
  const [paymentsPerYear, setPaymentsPerYear] = useState(String(source?.paymentsPerYear ?? 14));
  const [startDate, setStartDate] = useState(source?.startDate ?? localToday());
  const [endDate, setEndDate] = useState(source?.endDate ?? '');
  const [notes, setNotes] = useState(source?.notes ?? '');
  const [isActive, setIsActive] = useState(source?.isActive ?? true);

  // Só o empregador e o cliente têm salário fixo
  const salaryAllowed = kind === 'employer' || kind === 'client';
  const salary = salaryAllowed && hasSalary;
  const gross = number(grossAmount);
  const net = number(netAmount);
  const day = Number(payDay);
  const salaryValid =
    !salary || ((gross > 0 || net > 0) && Boolean(currencyId) && day >= 1 && day <= 31 && Boolean(startDate));
  const valid = name.trim().length > 0 && salaryValid;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    onSave({
      ...(source ? {} : { kind }),
      name: name.trim(),
      companyId: companyId || null,
      notes: notes.trim() || null,
      isActive,
      ...(salary
        ? {
            grossAmount: gross > 0 ? gross : null,
            netAmount: net > 0 ? net : null,
            currencyId,
            payDay: day,
            paymentsPerYear: Number(paymentsPerYear),
            startDate,
            endDate: endDate || null,
          }
        : {
            grossAmount: null,
            netAmount: null,
            payDay: null,
            paymentsPerYear: null,
            startDate: null,
            endDate: null,
          }),
    });
  };

  return (
    <Popover_Shell onClose={onClose} as="form" className="Narrow" onSubmit={submit}>
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{t(source ? 'earnings.sourceEditTitle' : 'earnings.sourceAddTitle')}</span>
          <span className="Popover_Subtitle">{t('earnings.sourceSubtitle')}</span>
        </div>
        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>

      <div className="Popover_Body Single_Column">
        {!source && (
          <div className="Form_Field">
            <div className="Tabs">
              {INCOME_SOURCE_KINDS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={kind === option ? 'Active' : ''} aria-pressed={kind === option}
                  onClick={() => setKind(option)}
                >
                  {t(`earnings.sourceKind_${option}`)}
                </button>
              ))}
            </div>
            <span className="Field_Hint">{t(`earnings.sourceKind_${kind}Hint`)}</span>
          </div>
        )}

        <div className="Form_Field">
          <label htmlFor="source-name">{t('earnings.sourceName')} *</label>
          <Global_Input id="source-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {(kind === 'employer' || kind === 'client') && (
          <div className="Form_Field">
            <label htmlFor="source-company">{t('earnings.sourceCompany')}</label>
            <Global_Dropdown
              id="source-company"
              value={companyId}
              onChange={(value) => setCompanyId(String(value))}
              options={[
                { value: NO_COMPANY, label: t('earnings.sourceNoCompany') },
                ...companies.map((company) => ({ value: company.id, label: company.name })),
              ]}
            />
            <span className="Field_Hint">{t('earnings.sourceCompanyHint')}</span>
          </div>
        )}

        {salaryAllowed && (
          <div className="Form_Field">
            <div className="Tabs">
              <button type="button" className={hasSalary ? '' : 'Active'} aria-pressed={!(hasSalary)} onClick={() => setHasSalary(false)}>
                {t('earnings.salaryNone')}
              </button>
              <button type="button" className={hasSalary ? 'Active' : ''} onClick={() => setHasSalary(true)}>
                {t('earnings.salaryFixed')}
              </button>
            </div>
            <span className="Field_Hint">{t('earnings.salaryFixedHint')}</span>
          </div>
        )}

        {salary && (
          <>
            <div className="Form_Field">
              <label htmlFor="source-currency">{t('earnings.currency')} *</label>
              <Global_Dropdown
                id="source-currency"
                value={currencyId}
                onChange={(value) => setCurrencyId(String(value))}
                options={currencies.map((currency) => ({
                  value: currency.id,
                  label: `${currency.shortCode} · ${currency.name}`,
                }))}
              />
            </div>
            <div className="Form_Field">
              <label htmlFor="source-gross">{t('earnings.grossMonthly')}</label>
              <Global_Input id="source-gross" value={grossAmount} onChange={(e) => setGrossAmount(e.target.value)} />
            </div>
            <div className="Form_Field">
              <label htmlFor="source-net">{t('earnings.netMonthly')}</label>
              <Global_Input id="source-net" value={netAmount} onChange={(e) => setNetAmount(e.target.value)} />
              <span className="Field_Hint">{t('earnings.netMonthlyHint')}</span>
            </div>
            <div className="Form_Field">
              <label htmlFor="source-times">{t('earnings.paymentsPerYear')}</label>
              <Global_Dropdown
                id="source-times"
                value={paymentsPerYear}
                onChange={(value) => setPaymentsPerYear(String(value))}
                options={[
                  { value: '14', label: t('memberPays.times14') },
                  { value: '12', label: t('memberPays.times12') },
                ]}
              />
            </div>
            <div className="Form_Field">
              <label htmlFor="source-day">{t('earnings.payDay')} *</label>
              <Global_Input id="source-day" type="number" value={payDay} onChange={(e) => setPayDay(e.target.value)} />
            </div>
            <div className="Form_Field">
              <label htmlFor="source-start">{t('earnings.startDate')} *</label>
              <Global_Input id="source-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="Form_Field">
              <label htmlFor="source-end">{t('earnings.endDate')}</label>
              <Global_Input id="source-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </>
        )}

        <div className="Form_Field">
          <label htmlFor="source-notes">{t('earnings.notes')}</label>
          <Global_Input id="source-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {source && (
          <div className="Form_Field">
            <div className="Tabs">
              <button type="button" className={isActive ? 'Active' : ''} aria-pressed={isActive} onClick={() => setIsActive(true)}>
                {t('common.active')}
              </button>
              <button type="button" className={isActive ? '' : 'Active'} onClick={() => setIsActive(false)}>
                {t('common.inactive')}
              </button>
            </div>
          </div>
        )}

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

export default Income_Source_Popover;
