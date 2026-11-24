import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router';
import * as Private_Page from '../../../Imports/privatePages';
import Page_Notice from '../../../Components/Page_Notice/Page_Notice';

/** As páginas dos espaços dos módulos (/w/:slug/...). O acesso já o viu o `Workspace_Layout`. */
const Workspace_Routes = () => {
  const { t } = useTranslation();

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/w/:slug/call-center" element={<Private_Page.Call_Center_Dashboard />} />
        <Route path="/w/:slug/call-center/dados" element={<Private_Page.Data_Overview />} />
        {/* As migalhas do meio (tabela, unida) voltam à lista */}
        <Route path="/w/:slug/call-center/dados/tabela" element={<Navigate to=".." relative="path" replace />} />
        <Route path="/w/:slug/call-center/dados/unida" element={<Navigate to=".." relative="path" replace />} />
        <Route path="/w/:slug/call-center/dados/tabela/nova" element={<Private_Page.Data_Table_New />} />
        <Route path="/w/:slug/call-center/dados/tabela/:tableId" element={<Private_Page.Data_Table_Page />} />
        <Route path="/w/:slug/call-center/dados/unida/nova" element={<Private_Page.Data_View_Form />} />
        <Route path="/w/:slug/call-center/dados/unida/:viewId" element={<Private_Page.Data_View_Page />} />
        <Route path="/w/:slug/call-center/dados/unida/:viewId/editar" element={<Private_Page.Data_View_Form />} />
        <Route path="/w/:slug/call-center/leads" element={<Private_Page.Leads_Page />} />
        <Route path="/w/:slug/call-center/leads/:boardId" element={<Private_Page.Leads_Page />} />
        <Route
          path="*"
          element={<Page_Notice title={t('notFound.title')} text={t('notFound.text')} actionText={t('notFound.back')} actionPath="/Dashboard" />}
        />
      </Routes>
    </Suspense>
  );
};

export default Workspace_Routes;
