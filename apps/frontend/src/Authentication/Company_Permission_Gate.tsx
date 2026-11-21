import type { ReactNode } from 'react';
import { useLocation, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompany } from '../Contexts/Company_Context';
import { companyRouteRequirement } from '../Containers/Navs/Navigation_Home/Menu_Itins';
import Page_Notice from '../Components/Page_Notice/Page_Notice';

// As páginas de uma empresa, como o Admin_Only: a permissão que a área (ou a
// secção) do menu pede. Aberta por URL sem ela, mostra um aviso sossegado em
// vez do erro cru do backend. O backend recusa na mesma.
const Company_Permission_Gate = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { slug } = useParams();
  const { company, access, activeModules, can, loading } = useCompany();

  // Enquanto o acesso desta empresa não chega, nada (sem piscar a página)
  if (loading) return null;

  // Empresa que não se conhece ou acesso que não se leu: a página trata do erro
  if (!slug || !company || !access) return <>{children}</>;

  const { area, permissions } = companyRouteRequirement(location.pathname, slug);
  const moduleOff = area.moduleName && !activeModules.some((m) => m.module.name === area.moduleName);
  const allowed = !permissions || can(...permissions);

  if (!allowed || moduleOff) {
    return (
      <Page_Notice
        title={t(moduleOff ? 'companies.areaUnavailableTitle' : 'companies.noPermissionTitle')}
        text={t(moduleOff ? 'companies.areaUnavailableText' : 'companies.noPermissionText')}
        actionText={t('companies.backToOverview')}
        actionPath={`/Companies/${slug}`}
      />
    );
  }

  return <>{children}</>;
};

export default Company_Permission_Gate;
