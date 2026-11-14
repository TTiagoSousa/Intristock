import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { useAsyncRequest } from '../useAsyncRequest';
import type { Tax } from '../Companies/useTaxes';

export interface CreateTaxPayload {
  countryId: string;
  name: string;
  description?: string;
  rate: number;
  category: string;
}

/** O catálogo de impostos todo, para a secção de admin: ver e acrescentar. */
export const useAdminTaxes = () => {
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const { loading, run } = useAsyncRequest(true);
  const { loading: saving, run: runSave } = useAsyncRequest();
  const { setAlert } = useAlert();
  const { t } = useTranslation();

  const refresh = async () => {
    const response = await run(() => http.get<Tax[]>(End_Points.Taxes_Endpoint()));
    if (response) setTaxes(response.data);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createTax = async (payload: CreateTaxPayload): Promise<boolean> => {
    // O que o admin cria é sempre "custom"; os "system" vêm com a instalação
    const response = await runSave(() => http.post(End_Points.Taxes_Endpoint(), { ...payload, type: 'custom' }));
    if (!response) return false;

    await refresh();
    setAlert({ open: true, message: t('adminTaxes.created'), type: 'success' });
    return true;
  };

  return { taxes, loading, saving, createTax };
};
