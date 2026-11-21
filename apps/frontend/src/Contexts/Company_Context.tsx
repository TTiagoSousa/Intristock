import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import http from '../Service/httpService';
import { End_Points } from '../Service/endPoints';
import { getErrorMessage, useAsyncRequest } from '../Hooks/useAsyncRequest';
import { useAlert } from './Alert_Context';
import type { Company } from '../Hooks/Companies/useCompanies';
import type { CompanyModule } from '../Hooks/Companies/useCompanyModules';
import type { CompanyAccess, CompanyPermission } from '../Hooks/Companies/companyPermissions';

interface CompanyContextType {
  // Empresa correspondente ao slug do URL, quando se está dentro de uma
  company: Company | undefined;
  activeModules: CompanyModule[];
  // O que o utilizador pode fazer nela: o dono tudo, um membro o do cargo
  access: CompanyAccess | null;
  // Uma de várias chega (as áreas que juntam várias, como as Compras)
  can: (...permissions: CompanyPermission[]) => boolean;
  loading: boolean;
  refreshModules: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

interface Company_Scope {
  companyId: string;
  access: CompanyAccess | null;
  activeModules: CompanyModule[];
}

const EMPTY_MODULES: CompanyModule[] = [];

export function CompanyProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { setAlert } = useAlert();
  const [companies, setCompanies] = useState<Company[]>([]);
  // Os módulos e o acesso ficam com o id da empresa a que pertencem: ao mudar
  // de empresa os da anterior deixam logo de valer (não se aplicam à nova)
  const [scope, setScope] = useState<Company_Scope | null>(null);
  // O pedido mais recente: uma resposta de um pedido anterior é ignorada
  const requestRef = useRef(0);

  const { loading: loadingCompanies, run } = useAsyncRequest(true);

  const slug = location.pathname.match(/^\/Companies\/([^/]+)/)?.[1];
  const company = companies.find((item) => item.slug === slug);
  const current = scope && company && scope.companyId === company.id ? scope : null;

  const fetchCompanies = async () => {
    const response = await run(() => http.get(End_Points.Companies_Endpoint()));
    if (response) setCompanies(response.data);
  };

  useEffect(() => {
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A lista é carregada uma vez. Se entrarmos numa empresa que ela não
  // conhece — acabada de criar noutro ecrã, ou um link colado — vale a pena
  // ir buscá-la outra vez, senão a barra e o painel ficavam no modo pessoal.
  useEffect(() => {
    if (slug && !company && !loadingCompanies) fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const refreshModules = async () => {
    const request = ++requestRef.current;

    if (!company) {
      setScope(null);
      return;
    }

    const companyId = company.id;
    // O acesso vai à parte: sem ele a barra não sabe o que mostrar
    const [accessResult, modulesResult] = await Promise.allSettled([
      http.get<CompanyAccess>(End_Points.Company_Access_Endpoint(companyId)),
      http.get<CompanyModule[]>(End_Points.Company_Modules_Endpoint(companyId)),
    ]);

    if (request !== requestRef.current) return;

    if (modulesResult.status === 'rejected') {
      setAlert({ open: true, message: getErrorMessage(modulesResult.reason), type: 'error' });
    }

    setScope((previous) => ({
      companyId,
      access: accessResult.status === 'fulfilled' ? accessResult.value.data : null,
      activeModules:
        modulesResult.status === 'fulfilled'
          ? modulesResult.value.data.filter((item) => item.isActive && item.module.isActive)
          : // Uma falha ao recarregar não esvazia a barra da mesma empresa
            previous?.companyId === companyId ? previous.activeModules : [],
    }));
  };

  const access = current?.access ?? null;
  const activeModules = current?.activeModules ?? EMPTY_MODULES;

  const can = (...permissions: CompanyPermission[]) =>
    !!access && (access.owner || permissions.some((p) => access.permissions.includes(p)));

  // Os módulos e o acesso são recarregados sempre que se muda de empresa
  useEffect(() => {
    refreshModules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  // A carregar só na primeira vez de cada empresa: recarregar os módulos da
  // mesma (ao ligar um) não desmonta os ecrãs, que perdiam os filtros
  const loading = loadingCompanies || Boolean(company && !current);

  return (
    <CompanyContext.Provider value={{ company, activeModules, access, can, loading, refreshModules }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);

  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }

  return context;
}
