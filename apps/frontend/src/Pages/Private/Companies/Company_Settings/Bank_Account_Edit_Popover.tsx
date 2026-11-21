import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../../../Contexts/Alert_Context';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import { usePlatforms } from '../../../../Hooks/usePlatforms';
import type {
  CompanyBankAccount,
  UpdateBankAccountPayload,
} from '../../../../Hooks/Companies/useCompanyBankAccounts';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';

interface Bank_Account_Edit_Popover_Props {
  account: CompanyBankAccount;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: UpdateBankAccountPayload) => Promise<boolean>;
}

const Bank_Account_Edit_Popover = ({
  account,
  saving,
  onClose,
  onSubmit,
}: Bank_Account_Edit_Popover_Props) => {
  const { t } = useTranslation();
  const { setAlert } = useAlert();
  const { currencies, loading: loadingCurrencies } = useCurrency();
  const { platforms, loading: loadingPlatforms } = usePlatforms();

  const [name, setName] = useState(account.name);
  const [iban, setIban] = useState(account.iban ?? '');
  const [platformId, setPlatformId] = useState(account.platformId);
  const [currencyId, setCurrencyId] = useState(account.currencyId);
  const [status, setStatus] = useState(account.status);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // A mesma regra do backend (@MinLength(2)), para não gastar um pedido
    if (name.trim().length < 2) {
      setAlert({ open: true, message: t('bankAccounts.nameTooShort'), type: 'error' });
      return;
    }

    const saved = await onSubmit({
      name: name.trim(),
      // Vazio limpa: uma conta de plataforma ou de cartão pode não ter IBAN
      iban: iban.trim(),
      platformId,
      currencyId,
      status,
    });

    if (saved) onClose();
  };

  return (
    <Popover_Shell onClose={onClose} as="form" className="Narrow" onSubmit={handleSubmit}>
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{t('bankAccounts.editTitle')}</span>
          <span className="Popover_Subtitle">{account.name}</span>
        </div>

        <button
          type="button"
          className="Popover_Close"
          onClick={onClose}
          aria-label={t('common.cancel')}
        >
          ×
        </button>
      </div>

      <div className="Popover_Body">
        <div className="Form_Field">
          <label htmlFor="account-name">{t('bankAccounts.name')} *</label>
          <Global_Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="Form_Field">
          <label htmlFor="account-iban">{t('bankAccounts.iban')}</label>
          <Global_Input id="account-iban" value={iban} onChange={(e) => setIban(e.target.value)} />
          <span className="Field_Hint">{t('bankAccounts.ibanHint')}</span>
        </div>

        <div className="Form_Field">
          <label htmlFor="account-platform">{t('bankAccounts.platform')}</label>
          <Global_Dropdown
            id="account-platform"
            value={platformId}
            onChange={(value) => setPlatformId(String(value))}
            disabled={loadingPlatforms}
            // As prop firms não têm contas bancárias
            options={platforms
              .filter((platform) => platform.type !== 'prop_firm')
              .map((platform) => ({ value: platform.id, label: platform.name }))}
          />
        </div>

        <div className="Form_Field">
          <label htmlFor="account-currency">{t('bankAccounts.currency')}</label>
          <Global_Dropdown
            id="account-currency"
            value={currencyId}
            onChange={(value) => setCurrencyId(String(value))}
            disabled={loadingCurrencies}
            options={currencies.map((currency) => ({
              value: currency.id,
              label: `${currency.shortCode} · ${currency.name}`,
            }))}
          />
          <span className="Field_Hint">{t('bankAccounts.currencyHint')}</span>
        </div>

        <div className="Form_Field">
          <label htmlFor="account-status">{t('bankAccounts.status')}</label>
          <Global_Dropdown
            id="account-status"
            value={status}
            onChange={(value) => setStatus(String(value))}
            options={[
              { value: 'active', label: t('bankAccounts.statusActive') },
              { value: 'inactive', label: t('bankAccounts.statusInactive') },
            ]}
          />
          <span className="Field_Hint">{t('bankAccounts.statusHint')}</span>
        </div>
      </div>

      <div className="Popover_Footer">
        <div className="Form_Action">
          <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
        </div>
        <div className="Form_Action">
          <Simple_Button
            type="submit"
            text={t('common.save')}
            disabled={saving}
          />
        </div>
      </div>
    </Popover_Shell>
  );
};

export default Bank_Account_Edit_Popover;
