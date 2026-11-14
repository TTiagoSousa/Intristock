import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../Contexts/Alert_Context';
import { useCountries } from '../../../Hooks/useCountries';
import { useCurrency } from '../../../Contexts/Currency_Context';
import type { Company } from '../../../Hooks/Companies/useCompanies';
import type { CreateCompanyPayload } from '../../../Hooks/Companies/useCreateCompany';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../Components/Buttons/Simple_Button/Simple_Button';

interface Company_Form_Popover_Props {
  // Só as empresas de que o user é dono podem ser empresa-mãe: o backend
  // recusa ligar a uma empresa que não é dele
  ownedCompanies: Company[];
  onClose: () => void;
  onSubmit: (payload: CreateCompanyPayload) => Promise<void>;
}

const Company_Form_Popover = ({ ownedCompanies, onClose, onSubmit }: Company_Form_Popover_Props) => {
  const { t } = useTranslation();
  const { setAlert } = useAlert();
  const { countries, loading: loadingCountries } = useCountries();
  const { currencies, loading: loadingCurrencies } = useCurrency();

  const [name, setName] = useState('');
  const [countryId, setCountryId] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [parentId, setParentId] = useState('');
  const [saving, setSaving] = useState(false);

  // Escolher o país sugere a moeda dele — a mesma regra que o backend aplica
  // quando não vem nenhuma. Deixa de sugerir assim que a moeda for mexida à
  // mão, senão trocar de país apagava a escolha de quem já tinha decidido.
  const [currencyTouched, setCurrencyTouched] = useState(false);

  useEffect(() => {
    if (currencyTouched || !countryId) return;

    const country = countries.find((item) => item.id === countryId);
    const match = currencies.find((item) => item.shortCode === country?.currency);

    setCurrencyId(match?.id ?? '');
  }, [countryId, countries, currencies, currencyTouched]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // A mesma regra do backend (@MinLength(2)), para não gastar um pedido
    if (name.trim().length < 2) {
      setAlert({ open: true, message: t('companies.nameTooShort'), type: 'error' });
      return;
    }

    setSaving(true);
    await onSubmit({
      name: name.trim(),
      countryId: countryId || undefined,
      currencyId: currencyId || undefined,
      parentId: parentId || undefined,
    });
    setSaving(false);
  };

  return (
    <div className="Popover_Backdrop" onClick={onClose}>
      <form
        className="Popover_Card Narrow"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{t('companies.createTitle')}</span>
            <span className="Popover_Subtitle">{t('companies.createSubtitle')}</span>
          </div>

          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body">
          <div className="Form_Field">
            <label htmlFor="company-name">{t('companies.columnName')} *</label>
            <Global_Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('companies.namePlaceholder')}
            />
            <span className="Field_Hint">{t('companies.slugHint')}</span>
          </div>

          <div className="Form_Field">
            <label htmlFor="company-country">{t('companies.columnCountry')}</label>
            <Global_Dropdown
              id="company-country"
              value={countryId}
              onChange={(value) => setCountryId(String(value))}
              disabled={loadingCountries}
              placeholder={t('companies.selectPlaceholder')}
              options={countries.map((country) => ({
                value: country.id,
                label: country.name,
              }))}
            />
          </div>

          <div className="Form_Field">
            <label htmlFor="company-currency">{t('companies.baseCurrency')}</label>
            <Global_Dropdown
              id="company-currency"
              value={currencyId}
              onChange={(value) => {
                setCurrencyTouched(true);
                setCurrencyId(String(value));
              }}
              disabled={loadingCurrencies}
              placeholder={t('companies.selectPlaceholder')}
              options={currencies.map((currency) => ({
                value: currency.id,
                label: `${currency.shortCode} · ${currency.name}`,
              }))}
            />
            <span className="Field_Hint">{t('companies.baseCurrencyHint')}</span>
          </div>

          {ownedCompanies.length > 0 && (
            <div className="Form_Field">
              <label htmlFor="company-parent">{t('companies.columnParent')}</label>
              <Global_Dropdown
                id="company-parent"
                value={parentId}
                onChange={(value) => setParentId(String(value))}
                placeholder={t('companies.noParent')}
                options={[
                  { value: '', label: t('companies.noParent') },
                  ...ownedCompanies.map((company) => ({ value: company.id, label: company.name })),
                ]}
              />
              <span className="Field_Hint">{t('companies.parentHint')}</span>
            </div>
          )}
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
          </div>
          <div className="Form_Action">
            <Simple_Button
              type="submit"
              text={saving ? t('common.saving') : t('companies.create')}
              disabled={saving}
            />
          </div>
        </div>
      </form>
    </div>
  );
};

export default Company_Form_Popover;
