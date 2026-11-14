import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCompanies } from '../../../../Hooks/Companies/useCompanies';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import './Company_Assets.scss';

// A visão geral da área. O registo de bens vive na secção; aqui fica o
// resumo, quando houver.
const Company_Assets = () => {
  const { slug } = useParams();
  const { companies, loading } = useCompanies();
  const { t } = useTranslation();

  const company = companies.find((item) => item.slug === slug);

  useBreadcrumbSegmentLabel(slug, company?.name);

  if (loading) {
    return (
      <div className="Company_Assets">
        <span className="Company_Assets_Message">{t('common.loading')}</span>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="Company_Assets">
        <span className="Company_Assets_Message">{t('companies.notFound')}</span>
      </div>
    );
  }

  return (
    <div className="Company_Assets">
      <div className="Assets_Header">
        <span className="Assets_Title">{t('menu.assets')}</span>
        <span className="Assets_Company">{company.name}</span>
      </div>
    </div>
  );
};

export default Company_Assets;
