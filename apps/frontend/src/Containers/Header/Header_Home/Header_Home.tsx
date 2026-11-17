import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNavs } from '../../../Contexts/Navs_Context';
import { useBreadcrumb } from '../../../Contexts/Breadcrumb_Context';
import { useAuth } from '../../../Contexts/Auth_Context';
import { useTheme } from '../../../Contexts/ThemeContext';
import * as Icon from '../../../Imports/icons';
import Notifications_Menu from '../../../Components/Notifications_Menu/Notifications_Menu';
import Currency_Menu from '../../../Components/Currency_Menu/Currency_Menu';
import './Header_Home.scss';

const PATH_LABELS: Record<string, string> = {
  Calculators: 'menu.calculators',
  'compound-interest': 'compoundInterest.title',
  simulacoes: 'menu.mySimulations',
  comparar: 'trading.compareTitle',
  favoritos: 'menu.favorites',
  Finances: 'finances.title',
  ganhos: 'menu.earnings',
  despesas: 'menu.expenses',
  dividas: 'menu.debts',
  Portefolio: 'menu.portfolio',
  Trading: 'trading.title',
  simulador: 'trading.simulator',
  'ao-vivo': 'trading.liveRunsTitle',
  Markets: 'markets.title',
  economia: 'markets.economy',
  Companies: 'companies.title',
  compras: 'companies.purchases',
  fornecedores: 'menu.suppliers',
  'new-supplier': 'suppliers.createTitle',
  'grupos-fornecedores': 'menu.supplierGroups',
  itens: 'items.title',
  'new-item': 'items.createTitle',
  pagamentos: 'menu.paymentsList',
  'proximos-pagamentos': 'menu.upcomingPayments',
  configuracao: 'menu.setup',
  stock: 'menu.stock',
  existencias: 'menu.stockBalance',
  movimentos: 'menu.stockMovements',
  ativos: 'menu.assets',
  registo: 'menu.assetsRegister',
  trading: 'companyTrading.title',
  membros: 'menu.companyMembers',
  cargos: 'menu.companyRoles',
  pessoa: 'menu.companyMember',
  modulos: 'modules.title',
  definicoes: 'menu.companySettings',
  Settings: 'menu.settings',
  Security: 'menu.security',
  Admin: 'menu.administration',
  Users: 'menu.users',
  Apis: 'menu.apis',
  'prop-firms': 'adminApis.propFirms.pageTitle',
  exchanges: 'adminApis.exchanges.pageTitle',
  Taxes: 'menu.taxes',
  Platforms: 'menu.platforms',
  Versions: 'menu.versions',
  Versoes: 'menu.versionsModule',
  atualizar: 'menu.versionsUpdate',
};

const Header_Home = () => {
  const { effectiveNavigation, toggleMobileMenu, isPanelCollapsed, togglePanel } = useNavs();
  const isMobile = effectiveNavigation === 'Mobile_Menu';
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { labels } = useBreadcrumb();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setIsAccountOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cada migalha guarda o caminho acumulado até si, para poder ser clicável
  const crumbs = location.pathname
    .split('/')
    .filter(Boolean)
    .filter((segment) => segment !== 'Dashboard')
    .map((segment, index, segments) => ({
      segment,
      path: `/${segments.slice(0, index + 1).join('/')}`,
      label: labels[segment] ?? (PATH_LABELS[segment] ? t(PATH_LABELS[segment]) : segment),
    }));

  const name = user?.name ?? user?.email ?? '';
  const initials = name
    .replace(/[^A-Za-zÀ-ÿ@ ]/g, '')
    .split(/[ @]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

  const themeLabel = theme === 'dark' ? t('settings.themeLight') : t('settings.themeDark');

  const handleLogout = async () => {
    setIsAccountOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <header className="Header_Home">
      {/* Em ecrã largo a navegação é fixa — o botão só existe no telemóvel,
          onde o painel tem mesmo de abrir por cima do conteúdo */}
      {isMobile ? (
        <button
          type="button"
          className="Icon_Button"
          onClick={toggleMobileMenu}
          aria-label={t('menu.menu')}
        >
          <Icon.Menu />
        </button>
      ) : (
        // Recolhe o painel das secções: os ícones dos módulos ficam sempre à vista
        <button
          type="button"
          className="Icon_Button"
          onClick={togglePanel}
          aria-label={t(isPanelCollapsed ? 'menu.expandPanel' : 'menu.collapsePanel')}
          title={t(isPanelCollapsed ? 'menu.expandPanel' : 'menu.collapsePanel')}
          aria-pressed={!isPanelCollapsed}
        >
          <Icon.Panel />
        </button>
      )}

      <nav className="Breadcrumb" aria-label="breadcrumb">
        <button type="button" className="Breadcrumb_Link" onClick={() => navigate('/Dashboard')}>
          <Icon.Home />
        </button>
        {crumbs.map((crumb, index) => (
          <span key={crumb.path} className="Breadcrumb_Item">
            <span className="Breadcrumb_Separator">/</span>
            {index === crumbs.length - 1 ? (
              <span className="Breadcrumb_Current">{crumb.label}</span>
            ) : (
              <button type="button" className="Breadcrumb_Link" onClick={() => navigate(crumb.path)}>
                {crumb.label}
              </button>
            )}
          </span>
        ))}
      </nav>

      <div className="Header_Spacer" />

      <Currency_Menu />

      <Notifications_Menu />

      <button
        type="button"
        className="Icon_Button"
        onClick={toggleTheme}
        aria-label={themeLabel}
      >
        {theme === 'dark' ? <Icon.Sun /> : <Icon.Moon />}
      </button>

      <div className="Account_Menu" ref={accountRef}>
        <button
          type="button"
          className="Account_Avatar"
          onClick={() => setIsAccountOpen((open) => !open)}
          aria-label={name}
          aria-expanded={isAccountOpen}
        >
          {initials || <Icon.Home />}
        </button>

        {isAccountOpen && (
          <div className="Account_Dropdown">
            <div className="Account_Dropdown_Head">
              <span className="Account_Dropdown_Name">{name}</span>
              {user?.email && <span className="Account_Dropdown_Mail">{user.email}</span>}
            </div>
            <button type="button" onClick={() => { navigate('/Settings/Security'); setIsAccountOpen(false); }}>
              {t('menu.security')}
            </button>
            <button type="button" onClick={() => { navigate('/Settings'); setIsAccountOpen(false); }}>
              {t('menu.generalSettings')}
            </button>
            <button type="button" className="Danger" onClick={handleLogout}>
              {t('menu.logout')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header_Home;
