import type { ComponentType } from 'react';
import type { CompanyPermission } from '../../../Hooks/Companies/companyPermissions';
import * as Icon from '../../../Imports/icons';

type IconComponent = ComponentType<{ color?: string }>;

export interface Menu_Section {
  id: string;
  labelKey: string;
  path: string;
  // Outros caminhos que também contam como estando nesta secção. As páginas de
  // configuração vivem fora do menu mas pertencem a um item dele. Um caminho
  // acabado em "/" conta com tudo o que vem a seguir (a página de cada registo).
  matchPaths?: string[];
  // Numa empresa: só aparece a quem tiver uma destas permissões do cargo
  permissions?: CompanyPermission[];
  // Recolhido um nível, para secções que dependem de outra
  nested?: boolean;
  // Abre o caminho, mas não fica marcada: a marcada é a filha com o mesmo caminho
  heading?: boolean;
  // Só aparece ao administrador, num grupo à parte ("Administração")
  adminOnly?: boolean;
  // Não navega: abre uma janela por cima da página em que se está
  action?: Menu_Action;
}

export type Menu_Action = 'portfolio-transaction';

export interface Menu_Module {
  id: string;
  labelKey: string;
  // Frase curta no topo do painel, a dizer o que este módulo é
  hintKey: string;
  icon: IconComponent;
  // Caminho por defeito ao clicar no ícone da barra
  path: string;
  sections: Menu_Section[];
}

/**
 * Barra de módulos — o primeiro nível, sempre visível e de altura fixa.
 *
 * Substituiu a lista única que crescia a cada módulo novo: os ícones ficam
 * todos à vista e é o painel ao lado que muda. Acrescentar um módulo passa a
 * custar um ícone, não mais uma linha no menu de toda a gente.
 */
export const modules: Menu_Module[] = [
  {
    id: 'dashboard',
    labelKey: 'menu.dashboard',
    hintKey: 'menu.dashboardHint',
    icon: Icon.Dashboard,
    path: '/Dashboard',
    sections: [
      { id: 'overview', labelKey: 'menu.overview', path: '/Dashboard' },
    ],
  },
  {
    id: 'calculators',
    labelKey: 'menu.calculators',
    hintKey: 'menu.calculatorsHint',
    icon: Icon.Calculator,
    path: '/Calculators',
    sections: [
      { id: 'all', labelKey: 'menu.calculatorsDashboard', path: '/Calculators' },
      { id: 'compound-interest', labelKey: 'compoundInterest.title', path: '/Calculators/compound-interest', nested: true },
      { id: 'simulations', labelKey: 'menu.mySimulations', path: '/Calculators/simulacoes' },
      { id: 'favorites', labelKey: 'menu.favorites', path: '/Calculators/favoritos' },
    ],
  },
  {
    id: 'finances',
    labelKey: 'finances.title',
    hintKey: 'finances.hint',
    icon: Icon.Wallet,
    path: '/Finances',
    sections: [
      { id: 'overview', labelKey: 'menu.overview', path: '/Finances' },
      { id: 'earnings', labelKey: 'menu.earnings', path: '/Finances/ganhos', heading: true },
      { id: 'earnings-dashboard', labelKey: 'menu.earningsDashboard', path: '/Finances/ganhos', nested: true },
      { id: 'earnings-register', labelKey: 'menu.earningsRegister', path: '/Finances/ganhos/registo', nested: true },
      { id: 'expenses', labelKey: 'menu.expenses', path: '/Finances/despesas', heading: true },
      { id: 'expenses-dashboard', labelKey: 'menu.expensesDashboard', path: '/Finances/despesas', nested: true },
      { id: 'expenses-register', labelKey: 'menu.expensesRegister', path: '/Finances/despesas/registo', nested: true },
      { id: 'expenses-items', labelKey: 'menu.expensesItems', path: '/Finances/despesas/itens', nested: true },
      { id: 'debts', labelKey: 'menu.debts', path: '/Finances/dividas', heading: true },
      { id: 'debts-dashboard', labelKey: 'menu.debtsDashboard', path: '/Finances/dividas', nested: true },
      { id: 'debts-register', labelKey: 'menu.debtsRegister', path: '/Finances/dividas/registo', nested: true },
    ],
  },
  {
    id: 'portfolio',
    labelKey: 'menu.portfolio',
    hintKey: 'portfolio.hint',
    icon: Icon.Pie,
    path: '/Portefolio',
    sections: [
      { id: 'dashboard', labelKey: 'menu.portfolioDashboard', path: '/Portefolio', matchPaths: ['/Portefolio/p/'] },
      { id: 'transactions', labelKey: 'menu.portfolioTransactions', path: '/Portefolio/transacoes', nested: true },
      { id: 'connections', labelKey: 'menu.portfolioConnections', path: '/Portefolio/corretoras' },
      { id: 'add', labelKey: 'menu.portfolioAddTransaction', path: '/Portefolio', action: 'portfolio-transaction' },
    ],
  },
  {
    id: 'markets',
    labelKey: 'markets.title',
    hintKey: 'markets.hint',
    icon: Icon.Trend,
    path: '/Markets',
    sections: [
      { id: 'assets', labelKey: 'markets.title', path: '/Markets' },
      { id: 'economy', labelKey: 'markets.economy', path: '/Markets/economia' },
    ],
  },
  {
    id: 'trading',
    labelKey: 'trading.title',
    hintKey: 'trading.hint',
    icon: Icon.Candles,
    path: '/Trading',
    sections: [
      { id: 'simulator', labelKey: 'trading.simulator', path: '/Trading/simulador' },
      { id: 'simulations', labelKey: 'trading.runsTitle', path: '/Trading/simulacoes', matchPaths: ['/Trading/simulacoes/'] },
      { id: 'live', labelKey: 'trading.liveRunsTitle', path: '/Trading/ao-vivo' },
    ],
  },
  {
    id: 'companies',
    labelKey: 'companies.title',
    hintKey: 'menu.companiesHint',
    icon: Icon.Company,
    path: '/Companies',
    sections: [
      { id: 'list', labelKey: 'companies.myCompanies', path: '/Companies' },
    ],
  },
  {
    id: 'versions',
    labelKey: 'menu.versionsModule',
    hintKey: 'menu.versionsHint',
    icon: Icon.Doc,
    path: '/Versoes',
    sections: [
      { id: 'news', labelKey: 'menu.versionsNews', path: '/Versoes' },
      { id: 'update', labelKey: 'menu.versionsUpdate', path: '/Versoes/atualizar', adminOnly: true },
    ],
  },
  {
    id: 'settings',
    labelKey: 'menu.settings',
    hintKey: 'menu.settingsHint',
    icon: Icon.Settings,
    path: '/Settings',
    sections: [
      { id: 'general', labelKey: 'menu.generalSettings', path: '/Settings' },
      { id: 'security', labelKey: 'menu.security', path: '/Settings/Security' },
      { id: 'admin-users', labelKey: 'menu.users', path: '/Settings/Admin/Users', adminOnly: true },
      { id: 'admin-apis', labelKey: 'menu.apis', path: '/Settings/Admin/Apis', adminOnly: true },
      { id: 'admin-taxes', labelKey: 'menu.taxes', path: '/Settings/Admin/Taxes', adminOnly: true },
      { id: 'admin-platforms', labelKey: 'menu.platforms', path: '/Settings/Admin/Platforms', adminOnly: true },
    ],
  },
];

export interface Company_Area {
  id: string;
  labelKey: string;
  icon: IconComponent;
  path: (slug: string) => string;
  sections?: (slug: string) => Menu_Section[];
  // Só aparece com este módulo ligado na empresa (`Module.name`)
  moduleName?: string;
  // Só aparece a quem tiver uma destas permissões do cargo (o dono vê tudo)
  permissions?: CompanyPermission[];
}

/**
 * Áreas de trabalho de uma empresa.
 *
 * Entrar numa empresa é entrar noutro sítio: a barra de módulos passa a ser a
 * dela e a sidebar inteira fica-lhe dedicada, com um caminho de saída sempre à
 * vista. Antes a empresa era mais um item espremido no menu pessoal.
 */
export const companyAreas: Company_Area[] = [
  {
    id: 'overview',
    labelKey: 'menu.overview',
    icon: Icon.Home,
    path: (slug) => `/Companies/${slug}`,
  },
  {
    id: 'purchases',
    labelKey: 'companies.purchases',
    icon: Icon.Wallet,
    path: (slug) => `/Companies/${slug}/compras`,
    permissions: ['payments.view', 'suppliers.view', 'items.view', 'salaries.view'],
    sections: (slug) => [
      { id: 'summary', labelKey: 'menu.purchasesDashboard', path: `/Companies/${slug}/compras`, permissions: ['payments.view'] },
      { id: 'payments', labelKey: 'menu.paymentsList', path: `/Companies/${slug}/compras/pagamentos`, permissions: ['payments.view'] },
      { id: 'upcoming', labelKey: 'menu.upcomingPayments', path: `/Companies/${slug}/compras/proximos-pagamentos`, permissions: ['salaries.view'] },
      { id: 'suppliers', labelKey: 'menu.suppliers', path: `/Companies/${slug}/compras/fornecedores`, permissions: ['suppliers.view'] },
      { id: 'groups', labelKey: 'menu.supplierGroups', path: `/Companies/${slug}/compras/grupos-fornecedores`, permissions: ['suppliers.view'] },
      { id: 'items', labelKey: 'menu.items', path: `/Companies/${slug}/compras/itens`, permissions: ['items.view'] },
      { id: 'setup', labelKey: 'menu.setup', path: `/Companies/${slug}/compras/configuracao`, permissions: ['settings.edit'] },
    ],
  },
  {
    id: 'stock',
    labelKey: 'menu.stock',
    icon: Icon.Box,
    path: (slug) => `/Companies/${slug}/stock`,
    permissions: ['stock.view'],
    sections: (slug) => [
      { id: 'summary', labelKey: 'menu.stockDashboard', path: `/Companies/${slug}/stock` },
      { id: 'balance', labelKey: 'menu.stockBalance', path: `/Companies/${slug}/stock/existencias` },
      { id: 'movements', labelKey: 'menu.stockMovements', path: `/Companies/${slug}/stock/movimentos` },
    ],
  },
  {
    id: 'assets',
    labelKey: 'menu.assets',
    icon: Icon.Machine,
    path: (slug) => `/Companies/${slug}/ativos`,
    permissions: ['assets.view'],
    sections: (slug) => [
      { id: 'summary', labelKey: 'menu.assetsDashboard', path: `/Companies/${slug}/ativos` },
      { id: 'register', labelKey: 'menu.assetsRegister', path: `/Companies/${slug}/ativos/registo` },
    ],
  },
  {
    id: 'trading',
    labelKey: 'companyTrading.title',
    icon: Icon.Candles,
    path: (slug) => `/Companies/${slug}/trading`,
    moduleName: 'trading',
    permissions: ['trading.view'],
  },
  {
    id: 'members',
    labelKey: 'menu.companyMembers',
    icon: Icon.Users,
    path: (slug) => `/Companies/${slug}/membros`,
    permissions: ['members.view'],
    sections: (slug) => [
      { id: 'members', labelKey: 'menu.companyMembers', path: `/Companies/${slug}/membros`, matchPaths: [`/Companies/${slug}/membros/pessoa/`] },
      { id: 'roles', labelKey: 'menu.companyRoles', path: `/Companies/${slug}/membros/cargos` },
    ],
  },
  {
    id: 'modules',
    labelKey: 'menu.modules',
    icon: Icon.Modules,
    path: (slug) => `/Companies/${slug}/modulos`,
    permissions: ['modules.view'],
  },
  {
    id: 'settings',
    labelKey: 'menu.companySettings',
    icon: Icon.Settings,
    path: (slug) => `/Companies/${slug}/definicoes`,
    permissions: ['settings.view'],
  },
];

/** O slug da empresa aberta, ou undefined se estivermos na área pessoal. */
export const companySlugFromPath = (pathname: string): string | undefined =>
  pathname.match(/^\/Companies\/([^/]+)/)?.[1];

/** Qual módulo pessoal está em uso, pelo caminho atual. */
export const activeModule = (pathname: string): Menu_Module => {
  const match = modules
    .filter((item) => item.id !== 'dashboard')
    .find((item) => pathname.startsWith(item.path));

  return match ?? modules[0];
};

/** Qual área da empresa está em uso. A visão geral é a que sobra. */
export const activeCompanyArea = (pathname: string, slug: string): Company_Area => {
  const match = companyAreas
    .filter((area) => area.id !== 'overview')
    .find((area) => pathname.startsWith(area.path(slug)));

  return match ?? companyAreas[0];
};
