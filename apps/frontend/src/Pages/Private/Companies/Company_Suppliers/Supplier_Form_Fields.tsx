import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  emptyPhone,
  type Supplier_Form_Phone,
  CREATE_ACCOUNT_OPTION,
  CREATE_GROUP_OPTION,
  DIRECT_PAYMENT_OPTION,
  type SupplierType,
  type Supplier_Form,
} from '../../../../Hooks/Companies/useSupplierForm';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import * as Icon from '../../../../Imports/icons';
import Bank_Account_Form_Popover from './Bank_Account_Form_Popover';
import Supplier_Group_Form_Popover from '../Company_Supplier_Groups/Supplier_Group_Form_Popover';

export type Field_Name =
  | 'name'
  | 'type'
  | 'group'
  | 'alias'
  | 'addressLine'
  | 'postalCode'
  | 'city'
  | 'country'
  | 'contact'
  | 'email'
  | 'bankAccount'
  | 'currency'
  | 'taxNumber'
  | 'isActive'
  | 'phones'
  | 'website'
  | 'details';

// O conjunto curto do popover de criar. A página escolhe os seus por secção.
const POPOVER_FIELDS: Field_Name[] = [
  'name',
  'type',
  'group',
  'alias',
  'taxNumber',
  'contact',
  'email',
  'country',
  'currency',
  'bankAccount',
  'website',
  'details',
  'isActive',
];

// Só os campos pedidos, pela ordem pedida. Os popovers de criar grupo e
// conta ficam no Supplier_Form_Popovers, fora do <form>: cada um tem o seu
// formulário e um <form> dentro de outro submetia os dois
const Supplier_Form_Fields = ({
  form,
  fields: visible = POPOVER_FIELDS,
}: {
  form: Supplier_Form;
  fields?: Field_Name[];
}) => {
  const { t } = useTranslation();
  const {
    values,
    setValue,
    countries,
    loadingCountries,
    currencies,
    loadingCurrencies,
    bankAccounts,
    loadingBankAccounts,
    groups,
    loadingGroups,
    setIsBankAccountFormOpen,
    setIsGroupFormOpen,
  } = form;

  const updatePhone = (key: string, changes: Partial<Supplier_Form_Phone>) =>
    setValue(
      'phones',
      values.phones.map((phone) => (phone.key === key ? { ...phone, ...changes } : phone)),
    );

  const fields: Record<Field_Name, ReactNode> = {
    name: (
      <div className="Form_Field">
        <label htmlFor="supplier-name">{t('suppliers.columnName')} *</label>
        <Global_Input
          id="supplier-name"
          value={values.name}
          onChange={(e) => setValue('name', e.target.value)}
          placeholder={t('suppliers.namePlaceholder')}
        />
      </div>
    ),
    type: (
      <div className="Form_Field">
        <label htmlFor="supplier-type">{t('suppliers.columnType')} *</label>
        <Global_Dropdown
          id="supplier-type"
          value={values.type}
          onChange={(value) => setValue('type', value as SupplierType)}
          options={[
            { value: 'company', label: t('suppliers.type_company') },
            { value: 'individual', label: t('suppliers.type_individual') },
            { value: 'partnership', label: t('suppliers.type_partnership') },
          ]}
        />
      </div>
    ),
    group: (
      <div className="Form_Field">
        <label htmlFor="supplier-group">{t('suppliers.columnGroup')}</label>
        <Global_Dropdown
          id="supplier-group"
          value={values.groupId}
          onChange={(value) => {
            if (value === CREATE_GROUP_OPTION) {
              setIsGroupFormOpen(true);
              return;
            }
      
            setValue('groupId', value as string);
          }}
          disabled={loadingGroups}
          placeholder={t('suppliers.selectPlaceholder')}
          options={[
            ...groups.map((group) => ({ value: group.id, label: group.name })),
            { value: CREATE_GROUP_OPTION, label: t('supplierGroups.addGroupOption') },
          ]}
        />
      </div>
    ),
    alias: (
      <div className="Form_Field">
        <label htmlFor="supplier-alias">{t('suppliers.alias')}</label>
        <Global_Input
          id="supplier-alias"
          value={values.alias}
          onChange={(e) => setValue('alias', e.target.value)}
          placeholder={t('suppliers.aliasPlaceholder')}
        />
      </div>
    ),
    taxNumber: (
      <div className="Form_Field">
        <label htmlFor="supplier-tax-id">{t('suppliers.columnTaxId')}</label>
        <Global_Input
          id="supplier-tax-id"
          value={values.taxNumber}
          onChange={(e) => setValue('taxNumber', e.target.value)}
          placeholder={t('suppliers.taxIdPlaceholder')}
        />
      </div>
    ),
    contact: (
      <div className="Form_Field">
        <label htmlFor="supplier-contact">{t('suppliers.contact')}</label>
        <Global_Input
          id="supplier-contact"
          value={values.contact}
          onChange={(e) => setValue('contact', e.target.value)}
          placeholder={t('suppliers.contactPlaceholder')}
        />
      </div>
    ),
    email: (
      <div className="Form_Field">
        <label htmlFor="supplier-email">{t('suppliers.email')}</label>
        <Global_Input
          id="supplier-email"
          type="email"
          value={values.email}
          onChange={(e) => setValue('email', e.target.value)}
          placeholder={t('suppliers.emailPlaceholder')}
        />
      </div>
    ),
    country: (
      <div className="Form_Field">
        <label htmlFor="supplier-country">{t('suppliers.columnCountry')}</label>
        <Global_Dropdown
          id="supplier-country"
          value={values.countryId}
          onChange={(value) => setValue('countryId', value as string)}
          disabled={loadingCountries}
          placeholder={t('suppliers.selectPlaceholder')}
          options={countries.map((country) => ({
            value: country.id,
            label: country.name,
          }))}
        />
      </div>
    ),
    currency: (
      <div className="Form_Field">
        <label htmlFor="supplier-currency">{t('suppliers.columnCurrency')}</label>
        <Global_Dropdown
          id="supplier-currency"
          value={values.currencyId}
          onChange={(value) => setValue('currencyId', value as string)}
          disabled={loadingCurrencies}
          placeholder={t('suppliers.selectPlaceholder')}
          options={currencies.map((currency) => ({
            value: currency.id,
            label: `${currency.shortCode} (${currency.symbol})`,
          }))}
        />
      </div>
    ),
    bankAccount: (
      <div className="Form_Field">
        <label htmlFor="supplier-bank-account">{t('suppliers.paymentMethod')}</label>
        <Global_Dropdown
          id="supplier-bank-account"
          value={values.bankAccountId}
          onChange={(value) => {
            if (value === CREATE_ACCOUNT_OPTION) {
              setIsBankAccountFormOpen(true);
              return;
            }
      
            setValue('bankAccountId', value as string);
          }}
          disabled={loadingBankAccounts}
          placeholder={t('suppliers.selectPlaceholder')}
          options={[
            { value: DIRECT_PAYMENT_OPTION, label: t('suppliers.directPayment') },
            ...bankAccounts.map((account) => ({
              value: account.id,
              label: account.iban ? `${account.name} — ${account.iban}` : account.name,
            })),
            { value: CREATE_ACCOUNT_OPTION, label: t('bankAccounts.addBankAccount') },
          ]}
        />
      </div>
    ),
    website: (
      <div className="Form_Field">
        <label htmlFor="supplier-website">{t('suppliers.website')}</label>
        <Global_Input
          id="supplier-website"
          value={values.website}
          onChange={(e) => setValue('website', e.target.value)}
          placeholder={t('suppliers.websitePlaceholder')}
        />
      </div>
    ),
    details: (
      <div className="Form_Field Full_Width">
        <label htmlFor="supplier-details">{t('suppliers.details')}</label>
        <textarea
          id="supplier-details"
          className="Form_Textarea"
          value={values.details}
          onChange={(e) => setValue('details', e.target.value)}
          placeholder={t('suppliers.detailsPlaceholder')}
          rows={3}
        />
      </div>
    ),
    isActive: (
      <div className="Form_Field Full_Width">
        <label className="Checkbox_Field" htmlFor="supplier-is-active">
          <input
            id="supplier-is-active"
            type="checkbox"
            checked={values.isActive}
            onChange={(e) => setValue('isActive', e.target.checked)}
          />
          <span>{t('suppliers.isActive')}</span>
        </label>
      </div>
    ),
    addressLine: (
      <div className="Form_Field Full_Width">
        <label htmlFor="supplier-address">{t('suppliers.addressLine')}</label>
        <Global_Input
          id="supplier-address"
          value={values.addressLine}
          onChange={(e) => setValue('addressLine', e.target.value)}
          placeholder={t('suppliers.addressLinePlaceholder')}
        />
      </div>
    ),
    postalCode: (
      <div className="Form_Field">
        <label htmlFor="supplier-postal-code">{t('suppliers.postalCode')}</label>
        <Global_Input
          id="supplier-postal-code"
          value={values.postalCode}
          onChange={(e) => setValue('postalCode', e.target.value)}
          placeholder={t('suppliers.postalCodePlaceholder')}
        />
      </div>
    ),
    city: (
      <div className="Form_Field">
        <label htmlFor="supplier-city">{t('suppliers.city')}</label>
        <Global_Input
          id="supplier-city"
          value={values.city}
          onChange={(e) => setValue('city', e.target.value)}
          placeholder={t('suppliers.cityPlaceholder')}
        />
      </div>
    ),
    phones: (
      <div className="Form_Field Full_Width">
        {/* Sem etiqueta: só aparece na página, na secção "Telefones" */}
        {values.phones.length === 0 ? (
          <span className="Field_Hint">{t('suppliers.noPhones')}</span>
        ) : (
          <div className="Supplier_Phones">
            {values.phones.map((phone) => (
              <div key={phone.key} className="Supplier_Phone">
                <Global_Input
                  value={phone.label}
                  onChange={(e) => updatePhone(phone.key, { label: e.target.value })}
                  placeholder={t('suppliers.phoneLabelPlaceholder')}
                />
                <Global_Input
                  value={phone.number}
                  onChange={(e) => updatePhone(phone.key, { number: e.target.value })}
                  placeholder={t('suppliers.phoneNumberPlaceholder')}
                />
                <button
                  type="button"
                  className="Row_Action Danger"
                  onClick={() =>
                    setValue(
                      'phones',
                      values.phones.filter((item) => item.key !== phone.key),
                    )
                  }
                  title={t('common.delete')}
                  aria-label={t('common.delete')}
                >
                  <Icon.Trash />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="Supplier_Phone_Add">
          <Simple_Button
            text={t('suppliers.addPhone')}
            variant="Ghost"
            small
            auto
            onClick={() => setValue('phones', [...values.phones, emptyPhone()])}
          />
        </div>
      </div>
    ),
  };

  return (
    <>
      {visible.map((field) => (
        <Fragment key={field}>{fields[field]}</Fragment>
      ))}
    </>
  );
};

export const Supplier_Form_Popovers = ({
  form,
  companyId,
  companyName,
}: {
  form: Supplier_Form;
  companyId: string;
  companyName: string;
}) => {
  const {
    setValue,
    refreshBankAccounts,
    refreshGroups,
    createGroup,
    isBankAccountFormOpen,
    setIsBankAccountFormOpen,
    isGroupFormOpen,
    setIsGroupFormOpen,
  } = form;

  return (
    <>
      {isGroupFormOpen && (
        <Supplier_Group_Form_Popover
          companyName={companyName}
          stacked
          onClose={() => setIsGroupFormOpen(false)}
          onSubmit={async (payload) => {
            const created = await createGroup(payload);

            if (created) {
              setIsGroupFormOpen(false);
              await refreshGroups();
              setValue('groupId', created.id);
            }
          }}
        />
      )}

      {isBankAccountFormOpen && (
        <Bank_Account_Form_Popover
          companyId={companyId}
          companyName={companyName}
          onClose={() => setIsBankAccountFormOpen(false)}
          onCreated={async (newBankAccountId) => {
            setIsBankAccountFormOpen(false);
            await refreshBankAccounts();
            setValue('bankAccountId', newBankAccountId);
          }}
        />
      )}
    </>
  );
};

export default Supplier_Form_Fields;
