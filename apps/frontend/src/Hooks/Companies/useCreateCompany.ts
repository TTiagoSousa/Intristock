import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { useAsyncRequest } from '../useAsyncRequest';
import type { Company } from './useCompanies';

export interface CreateCompanyPayload {
  name: string;
  countryId?: string;
  // A moeda base. Sem ela o backend usa a do país e, na falta dele, o euro.
  currencyId?: string;
  parentId?: string;
}

export const useCreateCompany = () => {
  const { loading, run } = useAsyncRequest();
  const { setAlert } = useAlert();
  const { t } = useTranslation();

  const createCompany = async (payload: CreateCompanyPayload): Promise<Company | undefined> => {
    // Os opcionais só seguem quando têm valor: o backend valida `parentId` e
    // `countryId` como UUID, e uma string vazia dava 400
    const body = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== '' && value !== undefined),
    );

    const response = await run(() => http.post(End_Points.Companies_Endpoint(), body));

    if (response) {
      setAlert({ open: true, message: t('companies.created'), type: 'success' });
    }

    return response?.data;
  };

  return { createCompany, loading };
};
