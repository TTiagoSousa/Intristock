import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import http from '../Service/httpService';
import { End_Points } from '../Service/endPoints';
import { useAsyncRequest } from '../Hooks/useAsyncRequest';
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

export function CompanyProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeModules, setActiveModules] = useState<CompanyModule[]>([]);
  const [access, setAccess] = useState<CompanyAccess | null>(null);

  const { loading, run } = useAsyncRequest(true);

  const slug = location.pathname.match(/^\/Companies\/([^/]+)/)?.[1];
  const company = companies.find((item) => item.slug === slug);

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
    if (slug && !company && !loading) fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const refreshModules = async () => {
    if (!company) {
      setActiveModules([]);
      setAccess(null);
      return;
    }

    // O acesso vai à parte: sem ele a barra não sabe o que mostrar
    http
      .get<CompanyAccess>(End_Points.Company_Access_Endpoint(company.id))
      .then((response) => setAccess(response.data))
      .catch(() => setAccess(null));

    const response = await run(() =>
      http.get(End_Points.Company_Modules_Endpoint(company.id)),
    );

    if (response) {
      setActiveModules(
        (response.data as CompanyModule[]).filter((item) => item.isActive && item.module.isActive),
      );
    }
  };

  const can = (...permissions: CompanyPermission[]) =>
    !!access && (access.owner || permissions.some((p) => access.permissions.includes(p)));

  // Os módulos e o acesso são recarregados sempre que se muda de empresa
  useEffect(() => {
    refreshModules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

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
