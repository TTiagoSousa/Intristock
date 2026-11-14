import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { useAsyncRequest } from '../useAsyncRequest';

export interface CreateCompanyBankAccountPayload {
  name: string;
  iban?: string;
  currencyId: string;
  platformId: string;
  initialBalance?: number;
}

export const useCreateCompanyBankAccount = (companyId: string | undefined) => {
  const { loading, run } = useAsyncRequest();
  const { setAlert } = useAlert();
  const { t } = useTranslation();

  const createBankAccount = async (payload: CreateCompanyBankAccountPayload) => {
    if (!companyId) return undefined;

    // O companyId vai no URL, não no body — a mesma regra dos fornecedores e
    // dos pagamentos
    const body = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== '' && value !== undefined),
    );

    const response = await run(() =>
      http.post(End_Points.Company_Bank_Accounts_Endpoint(companyId), body),
    );

    if (response) {
      setAlert({ open: true, message: t('bankAccounts.created'), type: 'success' });
    }

    return response?.data;
  };

  return { createBankAccount, loading };
};
