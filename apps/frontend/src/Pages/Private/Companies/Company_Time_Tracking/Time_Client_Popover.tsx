import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { CLIENT_BILLING, type Client_Billing, type Time_Client } from '../../../../Hooks/Companies/useTimeTracking';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';

export interface Time_Client_Input {
  supplierId?: string | null;
  createSupplier?: 'individual' | 'company';
  hourlyRate: number | null;
  billing: Client_Billing;
  withholdingPct: number | null;
}

interface Time_Client_Popover_Props {
  client: Time_Client;
  suppliers: { id: string; name: string }[];
  // O preço que vem da app (o do primeiro projeto com preço), para o campo dizer o que vale sem ele
  appRate: number | null;
  currencyCode: string;
  saving: boolean;
  onClose: () => void;
  onSave: (input: Time_Client_Input) => void;
}

// O valor do dropdown do cliente da empresa: um que existe, criar um novo, ou nenhum
const CREATE_INDIVIDUAL = '__create_individual';
const CREATE_COMPANY = '__create_company';

const parseNumber = (value: string) => {
  const text = value.trim().replace(',', '.');
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : NaN;
};

/**
 * O que um cliente da app é na empresa: o cliente (fornecedor) a que se liga — ou um novo com o
 * nome dele —, o preço por hora (vale mais que o da app), como se cobra e a retenção.
 */
const Time_Client_Popover = ({ client, suppliers, appRate, currencyCode, saving, onClose, onSave }: Time_Client_Popover_Props) => {
  const { t } = useTranslation();
  const groupId = useId();
  const [supplier, setSupplier] = useState(client.supplier?.id ?? '');
  const [rate, setRate] = useState(client.hourlyRate === null ? '' : String(client.hourlyRate));
  const [billing, setBilling] = useState<Client_Billing>(client.billing);
  const [withholding, setWithholding] = useState(client.withholdingPct === null ? '' : String(client.withholdingPct));

  const rateValue = parseNumber(rate);
  const withholdingValue = billing === 'freelance' ? parseNumber(withholding) : null;
  const invalid =
    Number.isNaN(rateValue) || Number.isNaN(withholdingValue) || (withholdingValue !== null && withholdingValue > 100);

  const submit = () => {
    if (invalid || saving) return;
    onSave({
      ...(supplier === CREATE_INDIVIDUAL
        ? { createSupplier: 'individual' }
        : supplier === CREATE_COMPANY
          ? { createSupplier: 'company' }
          : { supplierId: supplier || null }),
      hourlyRate: rateValue,
      billing,
      withholdingPct: withholdingValue,
    });
  };

  return (
    <Popover_Shell onClose={onClose} className="Narrow">
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{client.name}</span>
          <span className="Popover_Subtitle">{client.organizationName}</span>
        </div>
        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>

      <div className="Popover_Body Single_Column">
        <div className="Form_Field">
          <label htmlFor="time-client-supplier">{t('timeTracking.companyClient')}</label>
          <Global_Dropdown
            id="time-client-supplier"
            value={supplier}
            onChange={(value) => setSupplier(String(value))}
            options={[
              { value: '', label: t('timeTracking.noCompanyClient') },
              { value: CREATE_INDIVIDUAL, label: t('timeTracking.createIndividual', { name: client.name }) },
              { value: CREATE_COMPANY, label: t('timeTracking.createCompany', { name: client.name }) },
              ...suppliers.map((row) => ({ value: row.id, label: row.name, group: t('timeTracking.existingClients') })),
            ]}
          />
          <span className="Field_Hint">{t('timeTracking.companyClientHint')}</span>
        </div>

        <div className="Form_Field">
          <label htmlFor="time-client-rate">{t('timeTracking.hourlyRate', { currency: currencyCode })}</label>
          <Global_Input
            id="time-client-rate"
            value={rate}
            placeholder={appRate === null ? '' : String(appRate)}
            onChange={(event) => setRate(event.target.value)}
          />
          <span className="Field_Hint">
            {appRate === null ? t('timeTracking.hourlyRateHintNone') : t('timeTracking.hourlyRateHint', { rate: appRate })}
          </span>
        </div>

        <div className="Form_Field">
          <label id={`${groupId}-billing`}>{t('timeTracking.billing')}</label>
          <div className="Tabs" role="group" aria-labelledby={`${groupId}-billing`}>
            {CLIENT_BILLING.map((option) => (
              <button key={option} type="button" className={billing === option ? 'Active' : ''} aria-pressed={billing === option} onClick={() => setBilling(option)}>
                {t(`timeTracking.billing_${option}`)}
              </button>
            ))}
          </div>
          <span className="Field_Hint">{t(`timeTracking.billingHint_${billing}`)}</span>
        </div>

        {billing === 'freelance' && (
          <div className="Form_Field">
            <label htmlFor="time-client-withholding">{t('timeTracking.withholding')}</label>
            <Global_Input
              id="time-client-withholding"
              value={withholding}
              onChange={(event) => setWithholding(event.target.value)}
            />
            <span className="Field_Hint">{t('timeTracking.withholdingHint')}</span>
          </div>
        )}
      </div>

      <div className="Popover_Footer">
        <div className="Form_Action">
          <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
        </div>
        <div className="Form_Action">
          <Simple_Button text={t('common.save')} onClick={submit} disabled={invalid || saving} />
        </div>
      </div>
    </Popover_Shell>
  );
};

export default Time_Client_Popover;
