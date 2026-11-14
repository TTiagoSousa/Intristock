import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCompanies } from '../../../../Hooks/Companies/useCompanies';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import './Company_Stock.scss';

// A visão geral da área. As tabelas vivem nas secções (existências e
// movimentos); aqui fica o resumo, quando houver.
const Company_Stock = () => {
  const { slug } = useParams();
  const { companies, loading } = useCompanies();
  const { t } = useTranslation();

  const company = companies.find((item) => item.slug === slug);

  useBreadcrumbSegmentLabel(slug, company?.name);

  if (loading) {
    return (
      <div className="Company_Stock">
        <span className="Company_Stock_Message">{t('common.loading')}</span>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="Company_Stock">
        <span className="Company_Stock_Message">{t('companies.notFound')}</span>
      </div>
    );
  }

  return (
    <div className="Company_Stock">
      <div className="Stock_Header">
        <span className="Stock_Title">{t('menu.stock')}</span>
        <span className="Stock_Company">{company.name}</span>
      </div>
    </div>
  );
};

export default Company_Stock;
