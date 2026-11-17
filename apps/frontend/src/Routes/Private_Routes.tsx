import { Navigate, Route, Routes } from 'react-router-dom';
import * as Private_Page from '../Imports/privatePages';
import Admin_Only from '../Authentication/Admin_Only';

const Private_Routes = () => {
  return (
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
      <Route path='Versoes/atualizar' element={ <Admin_Only><Private_Page.Admin_Versions /></Admin_Only> } />
      <Route path='Companies' element={ <Private_Page.Companies /> } />
      <Route path='Companies/:slug' element={ <Private_Page.Company_Dashboard /> } />
      <Route path='Companies/:slug/compras' element={ <Private_Page.Company_Purchases /> } />
      <Route path='Companies/:slug/compras/configuracao' element={ <Private_Page.Company_Purchases_Setup /> } />
      <Route path='Companies/:slug/compras/fornecedores' element={ <Private_Page.Company_Suppliers /> } />
      <Route path='Companies/:slug/compras/fornecedores/new-supplier' element={ <Private_Page.Company_Supplier /> } />
      <Route path='Companies/:slug/compras/fornecedores/:supplierSlug' element={ <Private_Page.Company_Supplier /> } />
      <Route path='Companies/:slug/compras/grupos-fornecedores' element={ <Private_Page.Company_Supplier_Groups /> } />
      <Route path='Companies/:slug/compras/itens' element={ <Private_Page.Company_Items /> } />
      <Route path='Companies/:slug/compras/itens/new-item' element={ <Private_Page.Company_Item /> } />
      <Route path='Companies/:slug/compras/itens/:itemSlug' element={ <Private_Page.Company_Item /> } />
      <Route path='Companies/:slug/compras/pagamentos' element={ <Private_Page.Company_Payments /> } />
      <Route path='Companies/:slug/compras/proximos-pagamentos' element={ <Private_Page.Company_Upcoming_Payments /> } />
      <Route path='Companies/:slug/stock' element={ <Private_Page.Company_Stock /> } />
      <Route path='Companies/:slug/stock/existencias' element={ <Private_Page.Company_Stock_Balance /> } />
      <Route path='Companies/:slug/stock/movimentos' element={ <Private_Page.Company_Stock_Movements /> } />
      <Route path='Companies/:slug/ativos' element={ <Private_Page.Company_Assets /> } />
      <Route path='Companies/:slug/ativos/registo' element={ <Private_Page.Company_Assets_Register /> } />
      <Route path='Companies/:slug/trading' element={ <Private_Page.Company_Trading /> } />
      <Route path='Companies/:slug/membros' element={ <Private_Page.Company_Members /> } />
      <Route path='Companies/:slug/membros/cargos' element={ <Private_Page.Company_Roles /> } />
      <Route path='Companies/:slug/membros/pessoa/:memberId' element={ <Private_Page.Company_Member /> } />
      <Route path='Companies/:slug/modulos' element={ <Private_Page.Company_Modules /> } />
      <Route path='Companies/:slug/modulos/:moduleName' element={ <Private_Page.Company_Module_Settings /> } />
      <Route path='Companies/:slug/definicoes' element={ <Private_Page.Company_Settings /> } />
    </Routes>
  );
};

export default Private_Routes;
