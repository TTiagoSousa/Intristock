import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { getErrorMessage } from '../useAsyncRequest';

export interface SystemModule {
  id: string;
  name: string;
  label: string;
  description: string | null;
  icon: string | null;
  isActive: boolean;
}

export interface CompanyModule {
  id: string;
  companyId: string;
  moduleId: string;
  isActive: boolean;
  createdAt: string;
  module: SystemModule;
}

export const useCompanyModules = (companyId: string | undefined) => {
  const [catalog, setCatalog] = useState<SystemModule[]>([]);
  const [companyModules, setCompanyModules] = useState<CompanyModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // Estado assumido enquanto o servidor não confirma, para o interruptor
  // reagir no instante do clique
  const [pendingState, setPendingState] = useState<Record<string, boolean>>({});

  const { setAlert } = useAlert();
  const { t } = useTranslation();

  // silent = recarregar sem esconder a lista (usado depois de um toggle,
  // senão a página inteira piscava para "A carregar...")
  const fetchAll = async (silent = false) => {
    if (!companyId) return;

    if (!silent) setLoading(true);

    try {
      const [catalogResponse, companyResponse] = await Promise.all([
        http.get(End_Points.Modules_Endpoint()),
        http.get(End_Points.Company_Modules_Endpoint(companyId)),
      ]);

      setCatalog(catalogResponse.data);
      setCompanyModules(companyResponse.data);
    } catch (error: any) {
      setAlert({ open: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Adicionar pela primeira vez e ligar/desligar são chamadas diferentes:
  // o POST cria o CompanyModule, o PATCH só mexe no isActive
  const setModuleActive = async (moduleId: string, isActive: boolean) => {
    if (!companyId) return;

    const alreadyAdded = companyModules.some((item) => item.moduleId === moduleId);

    setTogglingId(moduleId);
    setPendingState((current) => ({ ...current, [moduleId]: isActive }));

    try {
      if (alreadyAdded) {
        await http.patch(End_Points.Company_Module_Endpoint(companyId, moduleId), { isActive });
      } else {
        await http.post(End_Points.Company_Modules_Endpoint(companyId), { moduleId });
      }

      await fetchAll(true);

      setAlert({
        open: true,
        message: t(isActive ? 'modules.activated' : 'modules.deactivated'),
        type: 'success',
      });
    } catch (error: any) {
      // Falhou: ao limpar o estado assumido, o interruptor volta ao que estava
      setAlert({ open: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      setPendingState((current) => {
        const { [moduleId]: _removed, ...rest } = current;
        return rest;
      });
      setTogglingId(null);
    }
  };

  const isModuleActive = (moduleId: string) =>
    moduleId in pendingState
      ? pendingState[moduleId]
      : companyModules.some((item) => item.moduleId === moduleId && item.isActive);

  return {
    catalog,
    companyModules,
    loading,
    togglingId,
    refresh: fetchAll,
    setModuleActive,
    isModuleActive,
  };
};
