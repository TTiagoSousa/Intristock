import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompanies } from '../../../../Hooks/Companies/useCompanies';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import { useCompany } from '../../../../Contexts/Company_Context';
import Payments_Chart from './Payments_Chart';
import './Company_Purchases.scss';

const Company_Purchases = () => {
  const { slug } = useParams();
  const { companies, loading } = useCompanies();
  const { t } = useTranslation();
  const { can } = useCompany();

  const company = companies.find((item) => item.slug === slug);

  useBreadcrumbSegmentLabel(slug, company?.name);

  if (loading) {
    return (
      <div className="Company_Purchases">
        <span className="Company_Purchases_Message">{t('common.loading')}</span>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="Company_Purchases">
        <span className="Company_Purchases_Message">{t('companies.notFound')}</span>
      </div>
    );
  }

  return (
    <div className="Company_Purchases">
      {can('payments.view') && <Payments_Chart company={company} />}
    </div>
  );
};

export default Company_Purchases;
