import { lazy, type ComponentType } from 'react';

// As páginas carregam-se por área, só quando se abre a primeira dela: o login e
// o resto da app não descarregam o simulador, os portefólios ou as empresas.
// Cada área é um ficheiro do bundle (os barris em ./Areas).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pages = Record<string, ComponentType<any>>;

const area = <M extends Pages>(load: () => Promise<M>) =>
  (name: keyof M & string) => lazy(async () => ({ default: (await load())[name] }));

const general = area(() => import('./Areas/generalPages'));
const finances = area(() => import('./Areas/financesPages'));
const portfolio = area(() => import('./Areas/portfolioPages'));
const trading = area(() => import('./Areas/tradingPages'));
const markets = area(() => import('./Areas/marketsPages'));
const company = area(() => import('./Areas/companyPages'));
const admin = area(() => import('./Areas/adminPages'));

// O esqueleto da área privada (barras, cabeçalho e rotas)
export const Main = lazy(() => import('../Pages/Private/Main/Main'));

export const Dashboard = general('Dashboard');
export const Calculators = general('Calculators');
export const Compound_Interest = general('Compound_Interest');
export const Minhas_Simulacoes = general('Minhas_Simulacoes');
export const Favoritos = general('Favoritos');
export const General = general('General');
export const Security = general('Security');
export const Finances = finances('Finances');
export const Earnings_Dashboard = finances('Earnings_Dashboard');
export const Earnings_Register = finances('Earnings_Register');
export const Expenses_Dashboard = finances('Expenses_Dashboard');
export const Expenses_Register = finances('Expenses_Register');
export const Expenses_Items = finances('Expenses_Items');
export const Debts_Dashboard = finances('Debts_Dashboard');
export const Debts_Register = finances('Debts_Register');
export const Portfolio_Dashboard = portfolio('Portfolio_Dashboard');
export const Portfolio_Transactions = portfolio('Portfolio_Transactions');
export const Portfolio_Connections = portfolio('Portfolio_Connections');
export const Portfolio_Page = portfolio('Portfolio_Page');
export const Trading_Simulator = trading('Trading_Simulator');
export const Trading_Simulations = trading('Trading_Simulations');
export const Trading_Compare = trading('Trading_Compare');
export const Trading_Simulation = trading('Trading_Simulation');
export const Trading_Live = trading('Trading_Live');
export const Markets = markets('Markets');
export const Economy = markets('Economy');
export const Companies = company('Companies');
export const Company_Dashboard = company('Company_Dashboard');
export const Company_Purchases = company('Company_Purchases');
export const Company_Suppliers = company('Company_Suppliers');
export const Company_Supplier = company('Company_Supplier');
export const Company_Supplier_Groups = company('Company_Supplier_Groups');
export const Company_Items = company('Company_Items');
export const Company_Item = company('Company_Item');
export const Company_Payments = company('Company_Payments');
export const Company_Purchases_Setup = company('Company_Purchases_Setup');
export const Company_Assets = company('Company_Assets');
export const Company_Assets_Register = company('Company_Assets_Register');
export const Company_Stock = company('Company_Stock');
export const Company_Stock_Balance = company('Company_Stock_Balance');
export const Company_Stock_Movements = company('Company_Stock_Movements');
export const Company_Modules = company('Company_Modules');
export const Admin_Prop_Firms = admin('Admin_Prop_Firms');
export const Admin_Prop_Firm = admin('Admin_Prop_Firm');
export const Admin_Exchanges = admin('Admin_Exchanges');
export const Company_Module_Settings = company('Company_Module_Settings');
export const Company_Trading = company('Company_Trading');
export const Time_Tracking_Overview = company('Time_Tracking_Overview');
export const Time_Tracking_Hours = company('Time_Tracking_Hours');
export const Time_Tracking_Clients = company('Time_Tracking_Clients');
export const Time_Tracking_Connections = company('Time_Tracking_Connections');
export const Company_Members = company('Company_Members');
export const Company_Member = company('Company_Member');
export const Company_Upcoming_Payments = company('Company_Upcoming_Payments');
export const Company_Roles = company('Company_Roles');
export const Company_Settings = company('Company_Settings');
export const Admin_Users = admin('Admin_Users');
export const Admin_Apis = admin('Admin_Apis');
export const Admin_Taxes = admin('Admin_Taxes');
export const Admin_Platforms = admin('Admin_Platforms');
export const Admin_Versions = admin('Admin_Versions');
export const Versions_News = general('Versions_News');
export const Invitations = general('Invitations');
