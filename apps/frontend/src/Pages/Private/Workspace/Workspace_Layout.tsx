import { useEffect, type ComponentType } from 'react';
import { Link, Navigate, NavLink, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompany } from '../../../Contexts/Company_Context';
import type { CompanyPermission } from '../../../Hooks/Companies/companyPermissions';
import { callCenterBase } from '../../../Containers/Navs/Navigation_Home/Menu_Itins';
import Page_Notice from '../../../Components/Page_Notice/Page_Notice';
import * as Icon from '../../../Imports/icons';
import Workspace_Routes from './Workspace_Routes';
import Header_Home from '../../../Containers/Header/Header_Home/Header_Home';
import './Workspace.scss';

interface Workspace_Def {
  moduleName: string;
  labelKey: string;
  icon: ComponentType<{ color?: string }>;
  // Basta uma (quem só trabalha as leads também entra)
  permission: CompanyPermission[];
  nav: (slug: string) => { id: string; labelKey: string; path: string; end?: boolean; permission: CompanyPermission }[];
}

// Os espaços dos módulos, pelo segmento do endereço (/w/:slug/<segmento>)
const WORKSPACES: Record<string, Workspace_Def> = {
  'call-center': {
    moduleName: 'call_center',
    labelKey: 'callCenter.title',
    icon: Icon.Phone,
    permission: ['data.view', 'leads.view'],
    nav: (slug) => [
      { id: 'dashboard', labelKey: 'callCenter.menuDashboard', path: callCenterBase(slug), end: true, permission: 'data.view' },
      { id: 'leads', labelKey: 'callCenter.menuLeads', path: `${callCenterBase(slug)}/leads`, permission: 'leads.view' },
      { id: 'data', labelKey: 'callCenter.menuData', path: `${callCenterBase(slug)}/dados`, permission: 'data.view' },
    ],
  },
};

/**
 * O espaço de um módulo (abre noutro separador a partir de «Módulos» na barra da
 * empresa): um ecrã só dele, sem as barras da app, com a navegação do módulo e
 * um caminho de volta. O acesso é o mesmo da app: o módulo ligado e a permissão.
 */
const Workspace_Layout = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { company, activeModules, can, loading, access } = useCompany();
  const [, , slug = '', segment = ''] = location.pathname.split('/');
  const workspace = WORKSPACES[segment];

  useEffect(() => {
    if (workspace && company) document.title = `${t(workspace.labelKey)} — ${company.name}`;
    return () => {
      document.title = 'IntriStock';
    };
  }, [workspace, company, t]);

  if (!workspace) {
    return (
      <div className="Workspace_Notice">
        <Page_Notice title={t('notFound.title')} text={t('notFound.text')} actionText={t('notFound.back')} actionPath="/Dashboard" />
      </div>
    );
  }

  // Enquanto a empresa e o acesso não chegam, nada (sem piscar)
  if (loading || (company && !access)) return null;

  const moduleOff = company && !activeModules.some((m) => m.module.name === workspace.moduleName);
  const blocked = !company ? 'notFound' : moduleOff ? 'off' : !can(...workspace.permission) ? 'denied' : null;

  if (blocked) {
    return (
      <div className="Workspace_Notice">
        <Page_Notice
          title={t(
            blocked === 'notFound' ? 'companies.notFound' : blocked === 'off' ? 'companies.areaUnavailableTitle' : 'companies.noPermissionTitle',
          )}
          text={t(
            blocked === 'notFound' ? 'notFound.text' : blocked === 'off' ? 'companies.areaUnavailableText' : 'companies.noPermissionText',
          )}
          actionText={t('workspace.backToApp')}
          actionPath={company ? `/Companies/${slug}` : '/Companies'}
        />
      </div>
    );
  }

  const Module_Icon = workspace.icon;
  const allNav = workspace.nav(slug);
  const nav = allNav.filter((item) => can(item.permission));
  // Quem não vê a primeira (o dashboard é dos Dados) vai para a primeira que vê
  const home = allNav[0].path;
  if (nav.length && nav[0].path !== home && location.pathname.replace(/\/$/, '') === home) {
    return <Navigate to={nav[0].path} replace />;
  }

  return (
    <div className="Workspace">
      <aside className="Workspace_Side">
        <div className="Workspace_Brand">
          <span className="Workspace_Brand_Icon"><Module_Icon /></span>
          <span className="Workspace_Brand_Text">
            <span className="Workspace_Brand_Name">{t(workspace.labelKey)}</span>
            <span className="Workspace_Brand_Company">{company!.name}</span>
          </span>
        </div>

        <nav className="Workspace_Nav" aria-label={t(workspace.labelKey)}>
          {nav.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.end}
              className={({ isActive }) => `Workspace_Nav_Item${isActive ? ' Active' : ''}`}
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        <Link className="Workspace_Back" to={`/Companies/${slug}`}>
          <Icon.Chevron_Left />
          {t('workspace.backToApp')}
        </Link>
      </aside>

      <main className="Workspace_Main">
        {/* O mesmo topo da app: o caminho (Empresas / a empresa / Call center / …), os avisos, o tema e a conta */}
        <Header_Home workspace />
        <div className="Workspace_View">
          <Workspace_Routes />
        </div>
      </main>
    </div>
  );
};

export default Workspace_Layout;
