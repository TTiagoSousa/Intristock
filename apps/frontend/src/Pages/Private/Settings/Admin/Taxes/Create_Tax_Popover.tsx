import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../../../Contexts/Alert_Context';
import { useCountries } from '../../../../../Hooks/useCountries';
import Global_Input from '../../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../../Components/Buttons/Simple_Button/Simple_Button';
import type { CreateTaxPayload } from '../../../../../Hooks/Admin/useAdminTaxes';
import Popover_Shell from '../../../../../Components/Popover_Shell/Popover_Shell';

// As categorias que os pagamentos conhecem; "outro" para o resto
const CATEGORIES = ['vat', 'purchase_tax', 'social_security', 'other'] as const;

interface Create_Tax_Popover_Props {
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateTaxPayload) => Promise<boolean>;
}

const Create_Tax_Popover = ({ saving, onClose, onSubmit }: Create_Tax_Popover_Props) => {
  const { t } = useTranslation();
  const { setAlert } = useAlert();
  const { countries, loading: loadingCountries } = useCountries();

  const [countryId, setCountryId] = useState('');
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [category, setCategory] = useState<string>('vat');
  const [description, setDescription] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const numericRate = Number(rate.replace(',', '.'));
    if (!countryId) {
      setAlert({ open: true, message: t('adminTaxes.countryRequired'), type: 'error' });
      return;
    }
    if (name.trim().length < 2) {
      setAlert({ open: true, message: t('adminTaxes.nameTooShort'), type: 'error' });
      return;
    }
    if (rate.trim() === '' || Number.isNaN(numericRate) || numericRate < 0) {
      setAlert({ open: true, message: t('adminTaxes.rateInvalid'), type: 'error' });
      return;
    }

    const saved = await onSubmit({
      countryId,
      name: name.trim(),
      rate: numericRate,
      category,
      ...(description.trim() ? { description: description.trim() } : {}),
    });
    if (saved) onClose();
  };

  return (
    <Popover_Shell onClose={onClose} as="form" className="Narrow" onSubmit={handleSubmit}>
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{t('adminTaxes.newTitle')}</span>
          <span className="Popover_Subtitle">{t('adminTaxes.newSubtitle')}</span>
        </div>
        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>

      <div className="Popover_Body">
        <div className="Form_Field">
          <label htmlFor="tax-country">{t('adminTaxes.country')} *</label>
          <Global_Dropdown
            id="tax-country"
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
          <label htmlFor="tax-name">{t('adminTaxes.name')} *</label>
          <Global_Input id="tax-name" value={name} placeholder="IVA 22% (Madeira)" onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="Form_Field">
          <label htmlFor="tax-rate">{t('adminTaxes.rate')} *</label>
          <Global_Input id="tax-rate" value={rate} placeholder="22" onChange={(e) => setRate(e.target.value)} />
          <span className="Field_Hint">{t('adminTaxes.rateHint')}</span>
        </div>

        <div className="Form_Field">
          <label htmlFor="tax-category">{t('adminTaxes.category')}</label>
          <Global_Dropdown
            id="tax-category"
            value={category}
            onChange={(value) => setCategory(String(value))}
            options={CATEGORIES.map((value) => ({ value, label: t(`adminTaxes.categories.${value}`) }))}
          />
        </div>

        <div className="Form_Field">
          <label htmlFor="tax-description">{t('adminTaxes.description')}</label>
          <Global_Input id="tax-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      <div className="Popover_Footer">
        <div className="Form_Action">
          <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
        </div>
        <div className="Form_Action">
          <Simple_Button type="submit" text={t('adminTaxes.create')} disabled={saving} />
        </div>
      </div>
    </Popover_Shell>
  );
};

export default Create_Tax_Popover;
