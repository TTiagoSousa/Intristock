import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompanies } from '../../../../Hooks/Companies/useCompanies';
import { useCompanyBankAccounts } from '../../../../Hooks/Companies/useCompanyBankAccounts';
import { useCompanyPayments } from '../../../../Hooks/Companies/useCompanyPayments';
import { useCompanySettings } from '../../../../Hooks/Companies/useCompanySettings';
import { useCountries } from '../../../../Hooks/useCountries';
import { usePlatforms } from '../../../../Hooks/usePlatforms';
import { useCurrency } from '../../../../Contexts/Currency_Context';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Bank_Account_Edit_Popover from './Bank_Account_Edit_Popover';
// Partilhado com o popover de fornecedores, que é de onde ele veio
import Bank_Account_Form_Popover from '../Company_Suppliers/Bank_Account_Form_Popover';
import Delete_Company_Popover from './Delete_Company_Popover';
import type { CompanyBankAccount } from '../../../../Hooks/Companies/useCompanyBankAccounts';
import * as Icon from '../../../../Imports/icons';
import { useCompany } from '../../../../Contexts/Company_Context';
import './Company_Settings.scss';

const Company_Settings = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { can, access } = useCompany();

  const { companies, loading: loadingCompanies, refresh } = useCompanies();
  const company = companies.find((item) => item.slug === slug);

  const { countries, loading: loadingCountries } = useCountries();
  const { currencies, loading: loadingCurrencies } = useCurrency();
  const { platforms } = usePlatforms();

  const {
    bankAccounts,
    loading: loadingAccounts,
    saving: savingAccount,
    refresh: refreshAccounts,
    updateBankAccount,
    deleteBankAccount,
  } = useCompanyBankAccounts(company?.id);

  // Serve só para saber se a moeda ainda se pode trocar — com pagamentos
  // gravados o backend recusa, e mais vale o campo dizê-lo antes de se tentar
  const { total: paymentCount } = useCompanyPayments(company?.id);

  const { updateCompany, updateStatus, deleteCompany, saving } = useCompanySettings();

  const [name, setName] = useState('');
  const [countryId, setCountryId] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [accountToEdit, setAccountToEdit] = useState<CompanyBankAccount | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isNewAccountOpen, setIsNewAccountOpen] = useState(false);

  useBreadcrumbSegmentLabel(slug, company?.name);

  // Os campos partem do que está gravado. Sem isto ficavam vazios até a lista
  // de empresas chegar, e gravar apagava o nome.
  useEffect(() => {
    if (!company) return;

    setName(company.name);
    setCountryId(company.countryId ?? '');
    setCurrencyId(company.currencyId);
  }, [company?.id, company?.name, company?.countryId, company?.currencyId]);

  if (loadingCompanies) {
    return (
      <div className="Company_Settings">
        <span className="Company_Settings_Message">{t('common.loading')}</span>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="Company_Settings">
        <span className="Company_Settings_Message">{t('companies.notFound')}</span>
      </div>
    );
  }

  const isInactive = company.status === 'inactive';
  const currencyLocked = paymentCount > 0;

  const hasChanges =
    name.trim() !== company.name ||
    countryId !== (company.countryId ?? '') ||
    currencyId !== company.currencyId;

  const handleSave = async () => {
    const updated = await updateCompany(company.id, {
      name: name.trim(),
      countryId: countryId || undefined,
      currencyId: currencyId !== company.currencyId ? currencyId : undefined,
    });

    if (!updated) return;

    await refresh();

    // Mudar o nome dá slug novo — sem isto ficávamos num endereço que já não
    // existe, e a página seguinte não encontrava a empresa
    if (updated.slug !== slug) {
      navigate(`/Companies/${updated.slug}/definicoes`, { replace: true });
    }
  };

  const platformName = (platformId: string) =>
    platforms.find((platform) => platform.id === platformId)?.name ?? '—';

  const currencyCode = (id: string) =>
    currencies.find((currency) => currency.id === id)?.shortCode ?? '—';

  return (
    <div className="Company_Settings">
      <div className="Page_Head">
        <div>
          <h1>{t('companySettings.title')}</h1>
          <div className="Page_Head_Sub">{company.name}</div>
        </div>
      </div>

      {/* Uma empresa parada abre-se toda, mas não aceita registos novos. Dizê-lo
          aqui poupa a descoberta pelo erro na primeira coisa que se tente. */}
      {isInactive && (
        <div className="Company_Paused">
          <span>{t('companySettings.pausedNotice')}</span>
          {access?.owner && (
            <Simple_Button
              text={t('companySettings.reactivate')}
              onClick={() => updateStatus(company.id, 'active').then(() => refresh())}
              disabled={saving}
              small
              auto
            />
          )}
        </div>
      )}

      <div className="Card Settings_List">
        <div className="Setting_Row">
          <div className="Setting_Text">
            <span className="Setting_Label">{t('companySettings.name')}</span>
            <span className="Setting_Hint">{t('companySettings.nameHint')}</span>
          </div>
          <div className="Setting_Control">
            <Global_Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isInactive}
            />
          </div>
        </div>

        <div className="Setting_Row">
          <div className="Setting_Text">
            <span className="Setting_Label">{t('companySettings.address')}</span>
            <span className="Setting_Hint">{t('companySettings.addressHint')}</span>
          </div>
          <div className="Setting_Control">
            <span className="Company_Slug">/Companies/{company.slug}</span>
          </div>
        </div>

        <div className="Setting_Row">
          <div className="Setting_Text">
            <span className="Setting_Label">{t('companies.columnCountry')}</span>
            <span className="Setting_Hint">{t('companySettings.countryHint')}</span>
          </div>
          <div className="Setting_Control">
            <Global_Dropdown
              id="company-country"
              value={countryId}
              onChange={(value) => setCountryId(String(value))}
              disabled={loadingCountries || isInactive}
              placeholder={t('companies.selectPlaceholder')}
              options={countries.map((country) => ({
                value: country.id,
                label: country.name,
              }))}
            />
          </div>
        </div>

        <div className="Setting_Row">
          <div className="Setting_Text">
            <span className="Setting_Label">{t('companies.baseCurrency')}</span>
            <span className="Setting_Hint">
              {currencyLocked
                ? t('companySettings.currencyLocked', { count: paymentCount })
                : t('companies.baseCurrencyHint')}
            </span>
          </div>
          <div className="Setting_Control">
            <Global_Dropdown
              id="company-currency"
              value={currencyId}
              onChange={(value) => setCurrencyId(String(value))}
              disabled={loadingCurrencies || currencyLocked || isInactive}
              options={currencies.map((currency) => ({
                value: currency.id,
                label: `${currency.shortCode} · ${currency.name}`,
              }))}
            />
          </div>
        </div>

        <div className="Setting_Row">
          <div className="Setting_Text" />
          <div className="Setting_Control">
            {can('settings.edit') && (
              <Simple_Button
                text={t('common.save')}
                onClick={handleSave}
                disabled={!hasChanges || saving || isInactive}
              />
            )}
          </div>
        </div>
      </div>

      <div className="Card Settings_Block">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('bankAccounts.title')}</span>
            <span className="Card_Subtitle">{t('companySettings.bankAccountsHint')}</span>
          </div>

          <div className="Card_Header_Action">
            {can('settings.edit') && (
              <Simple_Button
                text={t('bankAccounts.addAccount')}
                onClick={() => setIsNewAccountOpen(true)}
                disabled={isInactive}
              />
            )}
          </div>
        </div>

        <div className="Settings_Block_Body">
          {loadingAccounts ? (
            <span className="Company_Settings_Message">{t('common.loading')}</span>
          ) : bankAccounts.length === 0 ? (
            <div className="Empty_State">
              <span className="Empty_State_Title">{t('companySettings.noBankAccounts')}</span>
              <span className="Empty_State_Text">{t('companySettings.noBankAccountsHint')}</span>
              {can('settings.edit') && (
                <Simple_Button
                  text={t('bankAccounts.addAccount')}
                  onClick={() => setIsNewAccountOpen(true)}
                  disabled={isInactive}
                  auto
                />
              )}
            </div>
          ) : (
            <div className="Table_Wrap">
              <table className="Table">
                <thead>
                  <tr>
                    <th>{t('bankAccounts.name')}</th>
                    <th>{t('bankAccounts.iban')}</th>
                    <th>{t('bankAccounts.platform')}</th>
                    <th>{t('bankAccounts.currency')}</th>
                    <th>{t('bankAccounts.status')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {bankAccounts.map((account) => (
                    <tr key={account.id}>
                      <td>{account.name}</td>
                      <td className="Num Account_Iban">{account.iban || '—'}</td>
                      <td>{platformName(account.platformId)}</td>
                      <td className="Num">{currencyCode(account.currencyId)}</td>
                      <td>
                        <span className={`Pill ${account.status === 'active' ? 'Ok' : ''}`}>
                          <span className="Dot" />
                          {t(`bankAccounts.status${account.status === 'active' ? 'Active' : 'Inactive'}`)}
                        </span>
                      </td>
                      <td className="Right">
                        {can('settings.edit') && (
                        <div className="Row_Actions">
                          <button
                            type="button"
                            className="Row_Action"
                            onClick={() => setAccountToEdit(account)}
                            disabled={isInactive}
                            title={t('common.edit')}
                            aria-label={t('common.edit')}
                          >
                            <Icon.Edit />
                          </button>
                          <button
                            type="button"
                            className="Row_Action Danger"
                            onClick={() => deleteBankAccount(account.id)}
                            disabled={isInactive || savingAccount}
                            title={t('common.delete')}
                            aria-label={t('common.delete')}
                          >
                            <Icon.Trash />
                          </button>
                        </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Parar e apagar ficam juntos e no fim, longe do que se mexe todos os
          dias. São as duas únicas coisas nesta página que mudam a empresa
          inteira em vez de um campo. */}
      {access?.owner && (
        <div className="Card Settings_Block Danger_Zone">
          <div className="Card_Header">
            <div className="Card_Header_Text">
              <span className="Card_Title">{t('companySettings.dangerTitle')}</span>
              <span className="Card_Subtitle">{t('companySettings.dangerHint')}</span>
            </div>
          </div>
  
          <div className="Settings_List">
            <div className="Setting_Row">
              <div className="Setting_Text">
                <span className="Setting_Label">
                  {t(isInactive ? 'companySettings.reactivate' : 'companySettings.deactivate')}
                </span>
                <span className="Setting_Hint">
                  {t(isInactive ? 'companySettings.reactivateHint' : 'companySettings.deactivateHint')}
                </span>
              </div>
              <div className="Setting_Control">
                <Simple_Button
                  text={t(isInactive ? 'companySettings.reactivate' : 'companySettings.deactivate')}
                  onClick={() =>
                    updateStatus(company.id, isInactive ? 'active' : 'inactive').then(() => refresh())
                  }
                  disabled={saving}
                  variant="Ghost"
                />
              </div>
            </div>
  
            <div className="Setting_Row">
              <div className="Setting_Text">
                <span className="Setting_Label">{t('companySettings.deleteAction')}</span>
                <span className="Setting_Hint">{t('companySettings.deleteHint')}</span>
              </div>
              <div className="Setting_Control">
                <Simple_Button
                  text={t('companySettings.deleteAction')}
                  onClick={() => setIsDeleteOpen(true)}
                  disabled={saving}
                  variant="Danger"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {accountToEdit && (
        <Bank_Account_Edit_Popover
          account={accountToEdit}
          saving={savingAccount}
          onClose={() => setAccountToEdit(null)}
          onSubmit={(payload) => updateBankAccount(accountToEdit.id, payload)}
        />
      )}

      {isNewAccountOpen && (
        <Bank_Account_Form_Popover
          companyId={company.id}
          companyName={company.name}
          onClose={() => setIsNewAccountOpen(false)}
          onCreated={() => {
            setIsNewAccountOpen(false);
            refreshAccounts();
          }}
        />
      )}

      {isDeleteOpen && (
        <Delete_Company_Popover
          companyName={company.name}
          deleting={saving}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={async () => {
            const removed = await deleteCompany(company.id);

            if (removed) navigate('/Companies', { replace: true });
          }}
        />
      )}
    </div>
  );
};

export default Company_Settings;
