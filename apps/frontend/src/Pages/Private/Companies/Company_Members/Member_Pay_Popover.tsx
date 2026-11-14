import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import type {
  Member_Contract,
  Member_Pay,
  Member_Pay_Input,
  Member_Pay_Kind,
} from '../../../../Hooks/Companies/useCompanyMember';

const NO_CONTRACT = '';

interface Member_Pay_Popover_Props {
  // Sem salário é para criar um
  pay: Member_Pay | null;
  contracts: Member_Contract[];
  currencyCode: string;
  saving: boolean;
  onClose: () => void;
  onSave: (input: Member_Pay_Input) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Um salário (bruto por mês, 12 ou 14 vezes, o dia e o início/fim) ou um recibo
 * verde (o valor, a data e a retenção). O tipo escolhe-se só ao criar.
 */
const Member_Pay_Popover = ({ pay, contracts, currencyCode, saving, onClose, onSave }: Member_Pay_Popover_Props) => {
  const { t } = useTranslation();
  const [kind, setKind] = useState<Member_Pay_Kind>(pay?.kind ?? 'salary');
  const [grossAmount, setGrossAmount] = useState(pay ? String(Number(pay.grossAmount)) : '');
  const [description, setDescription] = useState(pay?.description ?? '');
  const [contractId, setContractId] = useState(pay?.contractId ?? NO_CONTRACT);
  const [paymentsPerYear, setPaymentsPerYear] = useState(String(pay?.paymentsPerYear ?? 14));
  const [payDay, setPayDay] = useState(String(pay?.payDay ?? 28));
  const [startDate, setStartDate] = useState(pay?.startDate?.slice(0, 10) ?? today());
  const [endDate, setEndDate] = useState(pay?.endDate?.slice(0, 10) ?? '');
  const [dueDate, setDueDate] = useState(pay?.dueDate?.slice(0, 10) ?? today());
  const [withholding, setWithholding] = useState(pay?.withholdingPct ? String(Number(pay.withholdingPct)) : '');

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const amount = Number(grossAmount.replace(',', '.'));
  const valid = amount > 0 && (kind === 'salary' ? Boolean(startDate) && Number(payDay) >= 1 : Boolean(dueDate));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const common = {
      grossAmount: amount,
      description: description.trim() || null,
      contractId: contractId || null,
    };
    onSave(
      kind === 'salary'
        ? {
            ...common,
            ...(pay ? {} : { kind }),
            paymentsPerYear: Number(paymentsPerYear),
            payDay: Number(payDay),
            startDate,
            endDate: endDate || null,
          }
        : {
            ...common,
            ...(pay ? {} : { kind }),
            dueDate,
            withholdingPct: withholding ? Number(withholding.replace(',', '.')) : null,
          },
    );
  };

  return (
    <div className="Popover_Backdrop" onClick={onClose}>
      <form className="Popover_Card Narrow" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{t(pay ? 'memberPays.editTitle' : 'memberPays.addTitle')}</span>
            <span className="Popover_Subtitle">{t('memberPays.subtitle', { currency: currencyCode })}</span>
          </div>
          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body Single_Column">
          {!pay && (
            <div className="Form_Field">
              <div className="Tabs">
                {(['salary', 'freelance'] as Member_Pay_Kind[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={kind === option ? 'Active' : ''}
                    onClick={() => setKind(option)}
                  >
                    {t(`memberPays.kind_${option}`)}
                  </button>
                ))}
              </div>
              <span className="Field_Hint">{t(`memberPays.kind_${kind}Hint`)}</span>
            </div>
          )}

          <div className="Form_Field">
            <label htmlFor="pay-amount">
              {t(kind === 'salary' ? 'memberPays.grossMonthly' : 'memberPays.grossAmount')} *
            </label>
            <Global_Input
              id="pay-amount"
              value={grossAmount}
              onChange={(e) => setGrossAmount(e.target.value)}
            />
          </div>

          {kind === 'salary' ? (
            <>
              <div className="Form_Field">
                <label htmlFor="pay-times">{t('memberPays.paymentsPerYear')}</label>
                <Global_Dropdown
                  id="pay-times"
                  value={paymentsPerYear}
                  onChange={(value) => setPaymentsPerYear(String(value))}
                  options={[
                    { value: '14', label: t('memberPays.times14') },
                    { value: '12', label: t('memberPays.times12') },
                  ]}
                />
              </div>
              <div className="Form_Field">
                <label htmlFor="pay-day">{t('memberPays.payDay')} *</label>
                <Global_Input
                  id="pay-day"
                  type="number"
                  value={payDay}
                  onChange={(e) => setPayDay(e.target.value)}
                />
              </div>
              <div className="Form_Field">
                <label htmlFor="pay-start">{t('memberPays.startDate')} *</label>
                <Global_Input id="pay-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="Form_Field">
                <label htmlFor="pay-end">{t('memberPays.endDate')}</label>
                <Global_Input id="pay-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                <span className="Field_Hint">{t('memberPays.endDateHint')}</span>
              </div>
            </>
          ) : (
            <>
              <div className="Form_Field">
                <label htmlFor="pay-due">{t('memberPays.dueDate')} *</label>
                <Global_Input id="pay-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="Form_Field">
                <label htmlFor="pay-withholding">{t('memberPays.withholding')}</label>
                <Global_Input
                  id="pay-withholding"
                  value={withholding}
                  onChange={(e) => setWithholding(e.target.value)}
                />
                <span className="Field_Hint">{t('memberPays.withholdingHint')}</span>
              </div>
            </>
          )}

          <div className="Form_Field">
            <label htmlFor="pay-contract">{t('memberPays.contract')}</label>
            <Global_Dropdown
              id="pay-contract"
              value={contractId}
              onChange={(value) => setContractId(String(value))}
              options={[
                { value: NO_CONTRACT, label: t('memberPays.noContract') },
                ...contracts.map((contract) => ({
                  value: contract.id,
                  label: contract.title || t(`memberContracts.type_${contract.type}`),
                })),
              ]}
            />
          </div>

          <div className="Form_Field">
            <label htmlFor="pay-description">{t('memberPays.description')}</label>
            <Global_Input id="pay-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
          </div>
          <div className="Form_Action">
            <Simple_Button
              type="submit"
              text={saving ? t('common.saving') : t('common.save')}
              disabled={saving || !valid}
            />
          </div>
        </div>
      </form>
    </div>
  );
};

export default Member_Pay_Popover;
