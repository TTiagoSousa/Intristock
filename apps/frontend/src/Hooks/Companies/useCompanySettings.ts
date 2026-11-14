import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { useAsyncRequest } from '../useAsyncRequest';
import type { Company } from './useCompanies';

export interface UpdateCompanyPayload {
  name?: string;
  countryId?: string;
  // Só passa enquanto a empresa não tiver pagamentos — depois disso o backend
  // recusa, porque trocá-la não converte valor nenhum
  currencyId?: string;
}

export type CompanyStatus = 'active' | 'inactive';

/**
 * Editar, parar e apagar uma empresa.
 *
 * Mudar o nome dá slug novo, por isso a empresa devolvida traz o slug atual —
 * é com ele que a página redireciona, senão ficava num endereço que já não
 * existe.
 */
export const useCompanySettings = () => {
  const { loading: saving, run } = useAsyncRequest();
  const { setAlert } = useAlert();
  const { t } = useTranslation();

  const updateCompany = async (
    companyId: string,
    payload: UpdateCompanyPayload,
  ): Promise<Company | undefined> => {
    // Campos vazios não seguem: o backend valida os opcionais como UUID e uma
    // string vazia falha a validação em vez de ser tratada como ausente
    const body = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== '' && value !== undefined),
    );

    const response = await run(() => http.patch(End_Points.Company_Endpoint(companyId), body));

    if (response) {
      setAlert({ open: true, message: t('companySettings.saved'), type: 'success' });
    }

    return response?.data;
  };

  const updateStatus = async (companyId: string, status: CompanyStatus) => {
    const response = await run(() =>
      http.patch(End_Points.Company_Status_Endpoint(companyId), { status }),
    );

    if (response) {
      setAlert({
        open: true,
        message: t(status === 'active' ? 'companySettings.reactivated' : 'companySettings.deactivated'),
        type: 'success',
      });
    }

    return Boolean(response);
  };

  const deleteCompany = async (companyId: string) => {
    const response = await run(() => http.delete(End_Points.Company_Endpoint(companyId)));

    if (response) {
      setAlert({ open: true, message: t('companySettings.deleted'), type: 'success' });
    }

    return Boolean(response);
  };

  return { updateCompany, updateStatus, deleteCompany, saving };
};
