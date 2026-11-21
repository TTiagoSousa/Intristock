import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompany } from '../../../../Contexts/Company_Context';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import './Company_Trading.scss';

/**
 * A área Trading de uma empresa (módulo `trading`). Por agora vazia: vai ter as
 * contas em corretoras e prop firms, as regras, o calendário e as estatísticas.
 */
const Company_Trading = () => {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { company, activeModules, loading } = useCompany();

  useBreadcrumbSegmentLabel(slug, company?.name);

  if (loading) {
    return (
      <div className="Company_Trading">
        <span className="Company_Trading_Message">{t('common.loading')}</span>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="Company_Trading">
        <span className="Company_Trading_Message">{t('companies.notFound')}</span>
      </div>
    );
  }

  // Pelo endereço chega-se cá com o módulo desligado: diz-se onde se liga
  const enabled = activeModules.some((m) => m.module.name === 'trading');

  return (
    <div className="Company_Trading">
      <div className="Card Company_Trading_Card">
        <div className="Card_Header">
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('companyTrading.title')}</span>
            <span className="Card_Subtitle">{t('companyTrading.subtitle')}</span>
          </div>
        </div>

        {enabled ? (
          <div className="Empty_State">
            <span className="Empty_State_Title">{t('companyTrading.emptyTitle')}</span>
            <span className="Empty_State_Text">{t('companyTrading.emptyText')}</span>
          </div>
        ) : (
          <div className="Empty_State">
            <span className="Empty_State_Title">{t('companyTrading.moduleOff')}</span>
            <Link className="Company_Trading_Link" to={`/Companies/${company.slug}/modulos`}>
              {t('companyTrading.moduleOffLink')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Company_Trading;
