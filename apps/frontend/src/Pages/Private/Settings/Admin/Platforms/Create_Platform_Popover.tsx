import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../../../Contexts/Alert_Context';
import { useCountries } from '../../../../../Hooks/useCountries';
import Global_Input from '../../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../../Components/Buttons/Simple_Button/Simple_Button';
import type { CreatePlatformPayload } from '../../../../../Hooks/Admin/useAdminPlatforms';
import type { Platform } from '../../../../../Hooks/usePlatforms';

const TYPES: Platform['type'][] = ['bank', 'broker', 'exchange', 'postal', 'prop_firm'];
const NO_COUNTRY = '';

interface Create_Platform_Popover_Props {
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: CreatePlatformPayload) => Promise<boolean>;
}

const Create_Platform_Popover = ({ saving, onClose, onSubmit }: Create_Platform_Popover_Props) => {
  const { t } = useTranslation();
  const { setAlert } = useAlert();
  const { countries, loading: loadingCountries } = useCountries();

  const [name, setName] = useState('');
  const [type, setType] = useState<Platform['type']>('bank');
  const [countryId, setCountryId] = useState(NO_COUNTRY);
  const [website, setWebsite] = useState('');

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (name.trim().length < 2) {
      setAlert({ open: true, message: t('adminPlatforms.nameTooShort'), type: 'error' });
      return;
    }

    const saved = await onSubmit({
      name: name.trim(),
      type,
      ...(countryId ? { countryId } : {}),
      ...(website.trim() ? { website: website.trim() } : {}),
    });
    if (saved) onClose();
  };

  return (
    <div className="Popover_Backdrop" onClick={onClose}>
      <form className="Popover_Card Narrow" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="Popover_Header">
          <div className="Popover_Header_Text">
            <span className="Popover_Title">{t('adminPlatforms.newTitle')}</span>
            <span className="Popover_Subtitle">{t('adminPlatforms.newSubtitle')}</span>
          </div>
          <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="Popover_Body">
          <div className="Form_Field">
            <label htmlFor="platform-name">{t('adminPlatforms.name')} *</label>
            <Global_Input id="platform-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="Form_Field">
            <label htmlFor="platform-type">{t('adminPlatforms.type')}</label>
            <Global_Dropdown
              id="platform-type"
              value={type}
              onChange={(value) => setType(value as Platform['type'])}
              options={TYPES.map((value) => ({ value, label: t(`adminPlatforms.types.${value}`) }))}
            />
          </div>

          <div className="Form_Field">
            <label htmlFor="platform-country">{t('adminPlatforms.country')}</label>
            <Global_Dropdown
              id="platform-country"
              value={countryId}
              onChange={(value) => setCountryId(String(value))}
              disabled={loadingCountries}
              options={[
                { value: NO_COUNTRY, label: t('adminPlatforms.international') },
                ...countries.map((country) => ({
                  value: country.id,
                  label: country.name,
                })),
              ]}
            />
          </div>

          <div className="Form_Field">
            <label htmlFor="platform-website">{t('adminPlatforms.website')}</label>
            <Global_Input
              id="platform-website"
              value={website}
              placeholder="https://"
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
        </div>

        <div className="Popover_Footer">
          <div className="Form_Action">
            <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
          </div>
          <div className="Form_Action">
            <Simple_Button type="submit" text={saving ? t('common.saving') : t('adminPlatforms.create')} disabled={saving} />
          </div>
        </div>
      </form>
    </div>
  );
};

export default Create_Platform_Popover;
