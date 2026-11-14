import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { useAsyncRequest } from '../useAsyncRequest';

export interface CreateCompanySupplierPayload {
  name: string;
  type: 'company' | 'individual' | 'partnership';
  alias?: string;
  groupId?: string;
  countryId?: string;
  currencyId?: string;
  paymentMethod?: 'bank_account' | 'direct';
  bankAccountId?: string;
  taxNumber?: string;
  contact?: string;
  email?: string;
  website?: string;
  details?: string;
  addressLine?: string;
  postalCode?: string;
  city?: string;
  // A lista inteira — substitui a que estava
  phones?: { label?: string; number: string }[];
  isActive?: boolean;
}

export const useCreateCompanySupplier = (companyId: string | undefined) => {
  const { loading, run } = useAsyncRequest();
  const { setAlert } = useAlert();
  const { t } = useTranslation();

  // Campos vazios não podem seguir: o backend valida os opcionais como UUID e
  // uma string vazia falha a validação em vez de ser tratada como ausente
  const cleanPayload = (payload: CreateCompanySupplierPayload) =>
    Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== '' && value !== undefined),
    );

  const createSupplier = async (payload: CreateCompanySupplierPayload) => {
    if (!companyId) return undefined;

    const response = await run(() =>
      http.post(End_Points.Company_Suppliers_Endpoint(companyId), cleanPayload(payload)),
    );

    if (response) {
      setAlert({ open: true, message: t('suppliers.created'), type: 'success' });
    }

    return response?.data;
  };

  const updateSupplier = async (supplierId: string, payload: CreateCompanySupplierPayload) => {
    if (!companyId) return undefined;

    const response = await run(() =>
      http.patch(End_Points.Company_Supplier_Endpoint(companyId, supplierId), cleanPayload(payload)),
    );

    if (response) {
      setAlert({ open: true, message: t('suppliers.updated'), type: 'success' });
    }

    return response?.data;
  };

  // O backend recusa quando há pagamentos ou itens — o alerta diz para desativar
  const deleteSupplier = async (supplierId: string) => {
    if (!companyId) return false;

    const response = await run(() =>
      http.delete(End_Points.Company_Supplier_Endpoint(companyId, supplierId)),
    );

    if (response) {
      setAlert({ open: true, message: t('suppliers.deleted'), type: 'success' });
    }

    return Boolean(response);
  };

  return { createSupplier, updateSupplier, deleteSupplier, loading };
};
