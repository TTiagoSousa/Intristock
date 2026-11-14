import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompanyBankAccounts } from './useCompanyBankAccounts';
import { useCompanySupplierGroupOptions } from './useCompanyOptions';
import { useCompanySupplierGroups } from './useCompanySupplierGroups';
import type { CompanySupplier } from './useCompanySuppliers';
import { useCreateCompanySupplier, type CreateCompanySupplierPayload } from './useCreateCompanySupplier';
import { useCountries } from '../useCountries';
import { useCurrency } from '../../Contexts/Currency_Context';
import { useAlert } from '../../Contexts/Alert_Context';

// Estado e gravação do formulário de fornecedor, partilhados pelo popover e
// pela página "Novo fornecedor" (Pages/Private/Companies/Company_Suppliers)
export type SupplierType = 'company' | 'individual' | 'partnership';

// Opções especiais do dropdown de pagamento, além das contas bancárias reais
export const DIRECT_PAYMENT_OPTION = '__direct__';
export const CREATE_ACCOUNT_OPTION = '__create_account__';
export const CREATE_GROUP_OPTION = '__create_group__';

// O segmento do URL da página de criar (…/fornecedores/new-supplier); os
// outros são o slug do fornecedor. O backend não deixa nenhum ficar com ele.
export const NEW_SUPPLIER_SEGMENT = 'new-supplier';

// Telefone extra em edição. A chave só serve ao React para distinguir as linhas
export interface Supplier_Form_Phone {
  key: string;
  label: string;
  number: string;
}

// Contador em vez de crypto.randomUUID, que só existe em https ou localhost
let phoneSeq = 0;

export const emptyPhone = (label = '', number = ''): Supplier_Form_Phone => ({
  key: `phone-${++phoneSeq}`,
  label,
  number,
});

// Os campos do fornecedor, partilhados pelo popover e pela página do
// fornecedor — o popover passa-os à página quando se carrega em "Avançadas"
export interface Supplier_Form_Values {
  name: string;
  type: SupplierType;
  groupId: string;
  alias: string;
  addressLine: string;
  postalCode: string;
  city: string;
  phones: Supplier_Form_Phone[];
  taxNumber: string;
  contact: string;
  email: string;
  countryId: string;
  currencyId: string;
  bankAccountId: string;
  website: string;
  details: string;
  isActive: boolean;
}

export const initialSupplierValues = (supplier?: CompanySupplier): Supplier_Form_Values => ({
  name: supplier?.name ?? '',
  type: supplier?.type ?? 'company',
  groupId: supplier?.group?.id ?? '',
  alias: supplier?.alias ?? '',
  addressLine: supplier?.addressLine ?? '',
  postalCode: supplier?.postalCode ?? '',
  city: supplier?.city ?? '',
  phones: (supplier?.phones ?? []).map((phone) => emptyPhone(phone.label ?? '', phone.number)),
  taxNumber: supplier?.taxNumber ?? '',
  contact: supplier?.contact ?? '',
  email: supplier?.email ?? '',
  countryId: supplier?.country?.id ?? '',
  currencyId: supplier?.currency?.id ?? '',
  bankAccountId:
    supplier?.paymentMethod === 'direct' ? DIRECT_PAYMENT_OPTION : supplier?.bankAccount?.id ?? '',
  website: supplier?.website ?? '',
  details: supplier?.details ?? '',
  isActive: supplier?.isActive ?? true,
});

interface Use_Supplier_Form_Options {
  companyId: string;
  // Quando vem preenchido, grava-se por cima dele em vez de criar um novo
  supplier?: CompanySupplier;
  initialValues?: Supplier_Form_Values;
  // Recebe o fornecedor gravado — a página precisa do slug, que muda com o nome
  onSaved: (supplier: CompanySupplier) => void;
}

export const useSupplierForm = ({
  companyId,
  supplier,
  initialValues,
  onSaved,
}: Use_Supplier_Form_Options) => {
  const { t } = useTranslation();
  const { setAlert } = useAlert();
  const { createSupplier, updateSupplier, loading: saving } = useCreateCompanySupplier(companyId);

  const { countries, loading: loadingCountries } = useCountries();
  const { currencies, loading: loadingCurrencies } = useCurrency();
  const {
    bankAccounts,
    loading: loadingBankAccounts,
    refresh: refreshBankAccounts,
  } = useCompanyBankAccounts(companyId);
  const { groups, loading: loadingGroups, refresh: refreshGroups } =
    useCompanySupplierGroupOptions(companyId);
  // Só para o "+ Criar grupo" do dropdown — a lista vem das opções acima
  const { createGroup } = useCompanySupplierGroups(companyId);

  const [isBankAccountFormOpen, setIsBankAccountFormOpen] = useState(false);
  const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);

  const [values, setValues] = useState<Supplier_Form_Values>(
    () => initialValues ?? initialSupplierValues(supplier),
  );

  const setValue = <K extends keyof Supplier_Form_Values>(field: K, value: Supplier_Form_Values[K]) =>
    setValues((current) => ({ ...current, [field]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (values.name.trim().length < 2) {
      setAlert({ open: true, message: t('suppliers.nameTooShort'), type: 'error' });
      return;
    }

    const isDirectPayment = values.bankAccountId === DIRECT_PAYMENT_OPTION;

    const payload: CreateCompanySupplierPayload = {
      name: values.name.trim(),
      type: values.type,
      groupId: values.groupId,
      alias: values.alias.trim(),
      taxNumber: values.taxNumber.trim(),
      contact: values.contact.trim(),
      email: values.email.trim(),
      countryId: values.countryId,
      currencyId: values.currencyId,
      paymentMethod: isDirectPayment ? 'direct' : 'bank_account',
      bankAccountId: isDirectPayment ? '' : values.bankAccountId,
      website: values.website.trim(),
      details: values.details.trim(),
      addressLine: values.addressLine.trim(),
      postalCode: values.postalCode.trim(),
      city: values.city.trim(),
      // Linhas sem número não seguem — são as que se acrescentaram e ficaram vazias
      phones: values.phones
        .filter((phone) => phone.number.trim())
        .map((phone) => ({ label: phone.label.trim() || undefined, number: phone.number.trim() })),
      isActive: values.isActive,
    };

    const saved = supplier
      ? await updateSupplier(supplier.id, payload)
      : await createSupplier(payload);

    if (saved) onSaved(saved);
  };

  return {
    values,
    setValue,
    submit,
    saving,
    countries,
    loadingCountries,
    currencies,
    loadingCurrencies,
    bankAccounts,
    loadingBankAccounts,
    refreshBankAccounts,
    groups,
    loadingGroups,
    refreshGroups,
    createGroup,
    isBankAccountFormOpen,
    setIsBankAccountFormOpen,
    isGroupFormOpen,
    setIsGroupFormOpen,
  };
};

export type Supplier_Form = ReturnType<typeof useSupplierForm>;
