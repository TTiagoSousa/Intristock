import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { getErrorMessage, useAsyncRequest } from '../useAsyncRequest';
import { usePaginatedResource } from '../usePaginatedResource';

export interface SupplierGroupMember {
  id: string;
  name: string;
  isActive: boolean;
}

export interface CompanySupplierGroup {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  suppliers: SupplierGroupMember[];
}

export const useCompanySupplierGroups = (companyId: string | undefined) => {
  // A leitura é paginada pelo servidor: dez por página, e a página 2 vai
  // buscar os dez seguintes. Para encher um dropdown usa-se o
  // `useCompanySupplierGroupOptions` — dez opções só deixariam escolher dez.
  const list = usePaginatedResource<CompanySupplierGroup>(
    companyId ? End_Points.Company_Supplier_Groups_Endpoint(companyId) : undefined,
  );

  const [savingId, setSavingId] = useState<string | null>(null);

  const { run } = useAsyncRequest();
  const { setAlert } = useAlert();
  const { t } = useTranslation();



  const createGroup = async (payload: { name: string; description?: string }) => {
    if (!companyId) return undefined;

    const response = await run(() =>
      http.post(End_Points.Company_Supplier_Groups_Endpoint(companyId), payload),
    );

    if (response) setAlert({ open: true, message: t('supplierGroups.created'), type: 'success' });

    return response?.data;
  };

  const updateGroup = async (groupId: string, payload: { name?: string; description?: string }) => {
    if (!companyId) return undefined;

    const response = await run(() =>
      http.patch(End_Points.Company_Supplier_Group_Endpoint(companyId, groupId), payload),
    );

    if (response) setAlert({ open: true, message: t('supplierGroups.updated'), type: 'success' });

    return response?.data;
  };

  const deleteGroup = async (groupId: string) => {
    if (!companyId) return false;

    setSavingId(groupId);

    try {
      await http.delete(End_Points.Company_Supplier_Group_Endpoint(companyId, groupId));

      await list.refresh();
      setAlert({ open: true, message: t('supplierGroups.deleted'), type: 'success' });
      return true;
    } catch (error: any) {
      setAlert({ open: true, message: getErrorMessage(error), type: 'error' });
      return false;
    } finally {
      setSavingId(null);
    }
  };

  // Define de uma vez quais os fornecedores do grupo (substitui os que lá estavam)
  const setGroupSuppliers = async (groupId: string, supplierIds: string[]) => {
    if (!companyId) return undefined;

    const response = await run(() =>
      http.put(End_Points.Company_Supplier_Group_Members_Endpoint(companyId, groupId), {
        supplierIds,
      }),
    );

    if (response) {
      setAlert({ open: true, message: t('supplierGroups.suppliersUpdated'), type: 'success' });
    }

    return response?.data;
  };

  return {
    groups: list.items,
    page: list.page,
    setPage: list.setPage,
    total: list.total,
    totalPages: list.totalPages,
    pageSize: list.pageSize,
    loadingPage: list.loadingPage,
    loading: list.loading,
    savingId,
    refresh: list.refresh,
    createGroup,
    updateGroup,
    deleteGroup,
    setGroupSuppliers,
  };
};
