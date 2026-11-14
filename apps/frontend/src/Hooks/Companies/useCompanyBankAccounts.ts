import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { useAsyncRequest } from '../useAsyncRequest';

export interface CompanyBankAccount {
  id: string;
  name: string;
  iban: string | null;
  currencyId: string;
  platformId: string;
  // active | inactive — uma conta com pagamentos fecha-se, não se apaga
  status: string;
}

export interface UpdateBankAccountPayload {
  name?: string;
  // String vazia limpa o IBAN: uma conta de plataforma ou cartão pode não ter
  iban?: string;
  platformId?: string;
  currencyId?: string;
  initialBalance?: number;
  status?: string;
}

export const useCompanyBankAccounts = (companyId: string | undefined) => {
  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccount[]>([]);

  const { loading, run } = useAsyncRequest(true);
  const { loading: saving, run: runSave } = useAsyncRequest();
  const { setAlert } = useAlert();
  const { t } = useTranslation();

  const fetchBankAccounts = async () => {
    if (!companyId) return;

    const response = await run(() => http.get(End_Points.Company_Bank_Accounts_Endpoint(companyId)));

    if (response) setBankAccounts(response.data);
  };

  const updateBankAccount = async (accountId: string, payload: UpdateBankAccountPayload) => {
    if (!companyId) return false;

    // O IBAN é a exceção: vazio quer dizer "limpa", por isso segue mesmo vazio
    const body = Object.fromEntries(
      Object.entries(payload).filter(([key, value]) => key === 'iban' || (value !== '' && value !== undefined)),
    );

    const response = await runSave(() =>
      http.patch(End_Points.Company_Bank_Account_Endpoint(companyId, accountId), body),
    );

    if (response) {
      await fetchBankAccounts();
      setAlert({ open: true, message: t('bankAccounts.updated'), type: 'success' });
    }

    return Boolean(response);
  };

  const deleteBankAccount = async (accountId: string) => {
    if (!companyId) return false;

    const response = await runSave(() =>
      http.delete(End_Points.Company_Bank_Account_Endpoint(companyId, accountId)),
    );

    if (response) {
      await fetchBankAccounts();
      setAlert({ open: true, message: t('bankAccounts.deleted'), type: 'success' });
    }

    return Boolean(response);
  };

  useEffect(() => {
    fetchBankAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  return {
    bankAccounts,
    loading,
    saving,
    refresh: fetchBankAccounts,
    updateBankAccount,
    deleteBankAccount,
  };
};
