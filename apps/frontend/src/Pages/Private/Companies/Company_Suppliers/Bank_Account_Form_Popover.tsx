import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateCompanyBankAccount } from '../../../../Hooks/Companies/useCreateCompanyBankAccount';
import { usePlatforms } from '../../../../Hooks/usePlatforms';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import { useAlert } from '../../../../Contexts/Alert_Context';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';

interface Bank_Account_Form_Popover_Props {
  companyId: string;
  companyName: string;
  onClose: () => void;
  onCreated: (bankAccountId: string) => void;
}

const Bank_Account_Form_Popover = ({
  companyId,
  companyName,
  onClose,
  onCreated,
}: Bank_Account_Form_Popover_Props) => {
  const { t } = useTranslation();
  const { setAlert } = useAlert();

  const { platforms, loading: loadingPlatforms } = usePlatforms();
  const { currencies, loading: loadingCurrencies } = useCurrency();
  const { createBankAccount, loading: saving } = useCreateCompanyBankAccount(companyId);

  const [name, setName] = useState('');
  const [platformId, setPlatformId] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [iban, setIban] = useState('');
  const [initialBalance, setInitialBalance] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (name.trim().length < 2) {
      setAlert({ open: true, message: t('bankAccounts.nameTooShort'), type: 'error' });
      return;
    }

    if (!platformId || !currencyId) {
      setAlert({ open: true, message: t('bankAccounts.platformAndCurrencyRequired'), type: 'error' });
      return;
    }

    const created = await createBankAccount({
      name: name.trim(),
      platformId,
      currencyId,
      iban: iban.trim(),
      initialBalance: initialBalance === '' ? undefined : Number(initialBalance),
    });

    if (created) onCreated(created.id);
  };

  return (
    <Popover_Shell
      onClose={onClose}
      backdropClassName="Stacked"
      as="form"
      className="Narrow"
      onSubmit={handleSubmit}
    >
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{t('bankAccounts.createTitle')}</span>
          <span className="Popover_Subtitle">{companyName}</span>
        </div>

        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>

      <div className="Popover_Body">
        <div className="Form_Field Full_Width">
          <label htmlFor="account-name">{t('bankAccounts.name')} *</label>
          <Global_Input
            id="account-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('bankAccounts.namePlaceholder')}
          />
        </div>

        <div className="Form_Field">
          <label htmlFor="account-platform">{t('bankAccounts.platform')} *</label>
          <Global_Dropdown
            id="account-platform"
            value={platformId}
            onChange={(value) => setPlatformId(value as string)}
            disabled={loadingPlatforms}
            placeholder={t('suppliers.selectPlaceholder')}
            // As prop firms não têm contas bancárias
            options={platforms.filter((platform) => platform.type !== 'prop_firm').map((platform) => ({
              value: platform.id,
              label: platform.name,
            }))}
          />
        </div>

        <div className="Form_Field">
          <label htmlFor="account-currency">{t('suppliers.columnCurrency')} *</label>
          <Global_Dropdown
            id="account-currency"
            value={currencyId}
            onChange={(value) => setCurrencyId(value as string)}
            disabled={loadingCurrencies}
            placeholder={t('suppliers.selectPlaceholder')}
            options={currencies.map((currency) => ({
              value: currency.id,
              label: `${currency.shortCode} (${currency.symbol})`,
            }))}
          />
        </div>

        <div className="Form_Field">
          <label htmlFor="account-iban">{t('bankAccounts.iban')}</label>
          <Global_Input
            id="account-iban"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            placeholder="PT50..."
          />
        </div>

        <div className="Form_Field">
          <label htmlFor="account-initial-balance">{t('bankAccounts.initialBalance')}</label>
          <Global_Input
            id="account-initial-balance"
            type="number"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div className="Popover_Footer">
        <div className="Form_Action">
          <Simple_Button text={t('common.cancel')} onClick={onClose} />
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

export default Bank_Account_Form_Popover;
