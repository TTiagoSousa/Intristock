import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompanies } from '../../../../Hooks/Companies/useCompanies';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import './Company_Purchases_Setup.scss';

// Páginas de configuração das Compras. Vivem aqui e não na sidebar para o menu
// não crescer com cada coisa nova que se configure.
const SETUP_PAGES = [
  { key: 'suppliers', path: 'fornecedores', titleKey: 'menu.suppliers', descriptionKey: 'purchasesSetup.suppliersDescription' },
  { key: 'supplier-groups', path: 'grupos-fornecedores', titleKey: 'menu.supplierGroups', descriptionKey: 'purchasesSetup.supplierGroupsDescription' },
  { key: 'items', path: 'itens', titleKey: 'menu.items', descriptionKey: 'purchasesSetup.itemsDescription' },
];

const Company_Purchases_Setup = () => {
  const { slug } = useParams();
  const { companies, loading } = useCompanies();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const company = companies.find((item) => item.slug === slug);

  useBreadcrumbSegmentLabel(slug, company?.name);

  if (loading) {
    return (
      <div className="Company_Purchases_Setup">
        <span className="Setup_Message">{t('common.loading')}</span>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="Company_Purchases_Setup">
        <span className="Setup_Message">{t('companies.notFound')}</span>
      </div>
    );
  }

  return (
    <div className="Company_Purchases_Setup">
      <div className="Setup_Header">
        <span className="Setup_Title">{t('purchasesSetup.title')}</span>
        <span className="Setup_Company">{company.name}</span>
      </div>

      <div className="Setup_Grid">
        {SETUP_PAGES.map((page) => (
          <button
            type="button"
            className="Setup_Card"
            key={page.key}
            onClick={() => navigate(`/Companies/${company.slug}/compras/${page.path}`)}
          >
            <span className="Setup_Card_Title">{t(page.titleKey)}</span>
            <span className="Setup_Card_Description">{t(page.descriptionKey)}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Company_Purchases_Setup;
