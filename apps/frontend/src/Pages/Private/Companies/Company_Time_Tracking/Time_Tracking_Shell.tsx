import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompany } from '../../../../Contexts/Company_Context';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import './Time_Tracking.scss';

type Company = NonNullable<ReturnType<typeof useCompany>['company']>;

interface Time_Tracking_Shell_Props {
  children: (company: Company) => ReactNode;
}

/**
 * O que as páginas do banco de horas têm em comum: a empresa a carregar ou não encontrada. O banco
 * de horas faz parte de todas as empresas (não é um módulo); as ligações estão em Definições → Apps ligadas.
 */
const Time_Tracking_Shell = ({ children }: Time_Tracking_Shell_Props) => {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { company, loading } = useCompany();

  useBreadcrumbSegmentLabel(slug, company?.name);

  if (loading || !company) {
    return (
      <div className="Time_Tracking">
        <span className="Time_Tracking_Message">{loading ? t('common.loading') : t('companies.notFound')}</span>
      </div>
    );
  }

  return <div className="Time_Tracking">{children(company)}</div>;
};

export default Time_Tracking_Shell;
