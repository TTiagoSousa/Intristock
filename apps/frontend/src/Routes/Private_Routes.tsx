import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, Route, Routes } from 'react-router';
import * as Private_Page from '../Imports/privatePages';
import Admin_Only from '../Authentication/Admin_Only';
import Company_Permission_Gate from '../Authentication/Company_Permission_Gate';
import Page_Notice from '../Components/Page_Notice/Page_Notice';

const Private_Routes = () => {
  const { t } = useTranslation();

  // As páginas carregam-se por área (Imports/privatePages): enquanto chega a
  // primeira de uma área, o espaço fica vazio, sem spinner
  return (
    <Suspense fallback={null}>
    <Routes>
      <Route index element={ <Private_Page.Dashboard /> } />
      <Route path='Dashboard' element={ <Private_Page.Dashboard /> } />
      <Route path='Calculators' element={ <Private_Page.Calculators /> } />
      <Route path='Calculators/compound-interest' element={ <Private_Page.Compound_Interest /> } />
      <Route path='Calculators/simulacoes' element={ <Private_Page.Minhas_Simulacoes /> } />
      <Route path='Calculators/favoritos' element={ <Private_Page.Favoritos /> } />
      <Route path='Finances' element={ <Private_Page.Finances /> } />
      <Route path='Finances/ganhos' element={ <Private_Page.Earnings_Dashboard /> } />
      <Route path='Finances/ganhos/registo' element={ <Private_Page.Earnings_Register /> } />
      <Route path='Finances/despesas' element={ <Private_Page.Expenses_Dashboard /> } />
      <Route path='Finances/despesas/registo' element={ <Private_Page.Expenses_Register /> } />
      <Route path='Finances/despesas/itens' element={ <Private_Page.Expenses_Items /> } />
      <Route path='Finances/dividas' element={ <Private_Page.Debts_Dashboard /> } />
      <Route path='Finances/dividas/registo' element={ <Private_Page.Debts_Register /> } />
      <Route path='Portefolio' element={ <Private_Page.Portfolio_Dashboard /> } />
      <Route path='Portefolio/transacoes' element={ <Private_Page.Portfolio_Transactions /> } />
      <Route path='Portefolio/corretoras' element={ <Private_Page.Portfolio_Connections /> } />
      {/* O segmento "Portefólios" do breadcrumb volta ao resumo, onde estão todos */}
      <Route path='Portefolio/p' element={ <Navigate to='/Portefolio' replace /> } />
      <Route path='Portefolio/p/:portfolioId' element={ <Private_Page.Portfolio_Page /> } />
      {/* O segmento "Trading" do breadcrumb abre o simulador, a única secção por agora */}
      <Route path='Trading' element={ <Navigate to='/Trading/simulador' replace /> } />
      <Route path='Trading/simulador' element={ <Private_Page.Trading_Simulator /> } />
      <Route path='Trading/simulacoes' element={ <Private_Page.Trading_Simulations /> } />
      <Route path='Trading/simulacoes/comparar' element={ <Private_Page.Trading_Compare /> } />
      <Route path='Trading/simulacoes/:runId' element={ <Private_Page.Trading_Simulation /> } />
      <Route path='Trading/ao-vivo' element={ <Private_Page.Trading_Live /> } />
      <Route path='Markets' element={ <Private_Page.Markets /> } />
      <Route path='Markets/economia' element={ <Private_Page.Economy /> } />
      <Route path='Settings' element={ <Private_Page.General /> } />
      <Route path='Settings/Security' element={ <Private_Page.Security /> } />
      {/* O segmento "Administração" do breadcrumb abre a primeira secção */}
      <Route path='Settings/Admin' element={ <Navigate to='/Settings/Admin/Users' replace /> } />
      <Route path='Settings/Admin/Users' element={ <Admin_Only><Private_Page.Admin_Users /></Admin_Only> } />
      <Route path='Settings/Admin/Apis' element={ <Admin_Only><Private_Page.Admin_Apis /></Admin_Only> } />
      <Route path='Settings/Admin/Apis/prop-firms' element={ <Admin_Only><Private_Page.Admin_Prop_Firms /></Admin_Only> } />
      <Route path='Settings/Admin/Apis/exchanges' element={ <Admin_Only><Private_Page.Admin_Exchanges /></Admin_Only> } />
      <Route path='Settings/Admin/Apis/prop-firms/:platformId' element={ <Admin_Only><Private_Page.Admin_Prop_Firm /></Admin_Only> } />
      <Route path='Settings/Admin/Taxes' element={ <Admin_Only><Private_Page.Admin_Taxes /></Admin_Only> } />
      <Route path='Settings/Admin/Platforms' element={ <Admin_Only><Private_Page.Admin_Platforms /></Admin_Only> } />
      {/* As versões passaram para o seu módulo: o endereço antigo leva ao novo */}
      <Route path='Settings/Admin/Versions' element={ <Navigate to='/Versoes/atualizar' replace /> } />
      <Route path='Versoes' element={ <Private_Page.Versions_News /> } />
      <Route path='Convites' element={ <Private_Page.Invitations /> } />
      <Route path='Versoes/atualizar' element={ <Admin_Only><Private_Page.Admin_Versions /></Admin_Only> } />
      <Route path='Companies' element={ <Private_Page.Companies /> } />
      {/* As páginas de uma empresa pedem a permissão da área do menu */}
      <Route path='Companies/:slug' element={ <Company_Permission_Gate><Outlet /></Company_Permission_Gate> }>
        <Route index element={ <Private_Page.Company_Dashboard /> } />
        <Route path='compras' element={ <Private_Page.Company_Purchases /> } />
        <Route path='compras/configuracao' element={ <Private_Page.Company_Purchases_Setup /> } />
        <Route path='compras/fornecedores' element={ <Private_Page.Company_Suppliers /> } />
        <Route path='compras/fornecedores/new-supplier' element={ <Private_Page.Company_Supplier /> } />
        <Route path='compras/fornecedores/:supplierSlug' element={ <Private_Page.Company_Supplier /> } />
        <Route path='compras/grupos-fornecedores' element={ <Private_Page.Company_Supplier_Groups /> } />
        <Route path='compras/itens' element={ <Private_Page.Company_Items /> } />
        <Route path='compras/itens/new-item' element={ <Private_Page.Company_Item /> } />
        <Route path='compras/itens/:itemSlug' element={ <Private_Page.Company_Item /> } />
        <Route path='compras/pagamentos' element={ <Private_Page.Company_Payments /> } />
        <Route path='compras/proximos-pagamentos' element={ <Private_Page.Company_Upcoming_Payments /> } />
        <Route path='stock' element={ <Private_Page.Company_Stock /> } />
        <Route path='stock/existencias' element={ <Private_Page.Company_Stock_Balance /> } />
        <Route path='stock/movimentos' element={ <Private_Page.Company_Stock_Movements /> } />
        <Route path='ativos' element={ <Private_Page.Company_Assets /> } />
        <Route path='ativos/registo' element={ <Private_Page.Company_Assets_Register /> } />
        <Route path='trading' element={ <Private_Page.Company_Trading /> } />
        <Route path='horas' element={ <Private_Page.Time_Tracking_Overview /> } />
        <Route path='horas/registo' element={ <Private_Page.Time_Tracking_Hours /> } />
        <Route path='horas/clientes' element={ <Private_Page.Time_Tracking_Clients /> } />
        <Route path='definicoes/apps' element={ <Private_Page.Time_Tracking_Connections /> } />
        <Route path='membros' element={ <Private_Page.Company_Members /> } />
        <Route path='membros/cargos' element={ <Private_Page.Company_Roles /> } />
        <Route path='membros/pessoa/:memberId' element={ <Private_Page.Company_Member /> } />
        <Route path='modulos' element={ <Private_Page.Company_Modules /> } />
        <Route path='modulos/:moduleName' element={ <Private_Page.Company_Module_Settings /> } />
        <Route path='definicoes' element={ <Private_Page.Company_Settings /> } />
      </Route>
      {/* Um endereço que não existe */}
      <Route
        path='*'
        element={
          <Page_Notice
            title={t('notFound.title')}
            text={t('notFound.text')}
            actionText={t('notFound.back')}
            actionPath='/Dashboard'
          />
        }
      />
    </Routes>
    </Suspense>
  );
};

export default Private_Routes;
