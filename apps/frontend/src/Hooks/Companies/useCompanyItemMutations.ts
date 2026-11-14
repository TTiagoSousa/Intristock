import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { getErrorMessage, useAsyncRequest } from '../useAsyncRequest';
import type { CompanyItem, CompanyItemPayload } from './useCompanyItems';

// Campos vazios não podem seguir: o backend valida os opcionais como UUID e
// uma string vazia falha a validação em vez de ser tratada como ausente
const cleanPayload = (payload: CompanyItemPayload) =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== '' && value !== undefined),
  );

/**
 * Criar, editar e apagar itens, sem ir buscar a lista — a lista
 * (`useCompanyItems`), a página do item e o popover usam todos isto.
 */
export const useCompanyItemMutations = (companyId: string | undefined) => {
  const { loading, run } = useAsyncRequest();
  const { setAlert } = useAlert();
  const { t } = useTranslation();

  const createItem = async (payload: CompanyItemPayload): Promise<CompanyItem | undefined> => {
    if (!companyId) return undefined;

    const response = await run(() =>
      http.post(End_Points.Company_Items_Endpoint(companyId), cleanPayload(payload)),
    );

    if (response) setAlert({ open: true, message: t('items.created'), type: 'success' });

    return response?.data;
  };

  const updateItem = async (
    itemId: string,
    payload: CompanyItemPayload,
  ): Promise<CompanyItem | undefined> => {
    if (!companyId) return undefined;

    const response = await run(() =>
      http.patch(End_Points.Company_Item_Endpoint(companyId, itemId), cleanPayload(payload)),
    );

    if (response) setAlert({ open: true, message: t('items.updated'), type: 'success' });

    return response?.data;
  };

  // O backend recusa quando o item já foi usado numa compra — o alerta diz porquê
  const deleteItem = async (itemId: string) => {
    if (!companyId) return false;

    try {
      await http.delete(End_Points.Company_Item_Endpoint(companyId, itemId));
      setAlert({ open: true, message: t('items.deleted'), type: 'success' });
      return true;
    } catch (error) {
      setAlert({ open: true, message: getErrorMessage(error), type: 'error' });
      return false;
    }
  };

  return { createItem, updateItem, deleteItem, saving: loading };
};
