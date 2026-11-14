import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCompanies } from '../../../../Hooks/Companies/useCompanies';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import './Company_Dashboard.scss';

// Secções de gestão da empresa. Só as que já têm página é que aparecem aqui —
// acrescentar linha nova à medida que forem sendo construídas.
const COMPANY_SECTIONS = [
  { key: 'purchases', path: 'compras', titleKey: 'companies.purchases', descriptionKey: 'companies.purchasesDescription' },
];

const Company_Dashboard = () => {
  const { slug } = useParams();
  const { companies, loading } = useCompanies();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const company = companies.find((item) => item.slug === slug);

  useBreadcrumbSegmentLabel(slug, company?.name);

  if (loading) {
    return (
      <div className="Company_Dashboard">
        <span className="Company_Dashboard_Message">{t('common.loading')}</span>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="Company_Dashboard">
        <span className="Company_Dashboard_Message">{t('companies.notFound')}</span>
      </div>
    );
  }

  return (
    <div className="Company_Dashboard">
      {/* O mesmo cabeçalho das outras páginas: o nome, a empresa mãe por baixo
          e o papel de quem a vê à direita, em texto discreto */}
      <div className="Page_Head">
        <div>
          <h1>{company.name}</h1>
          {company.parent && (
            <div className="Page_Head_Sub">
              {t('companies.parentCompany', { name: company.parent.name })}
            </div>
          )}
        </div>

        <div className="Page_Head_Actions">
          <span className="Pill">
            {t(company.role === 'owner' ? 'companies.roleOwner' : 'companies.roleMember')}
          </span>
        </div>
      </div>

      <div className="Sections_Card">
        <div className="Card_Header">
          <span className="Card_Title">{t('companies.sectionsTitle')}</span>
        </div>

        <div className="Sections_Body">
          <table className="Sections_Table">
            <thead>
              <tr>
                <th>{t('companies.sectionColumnName')}</th>
                <th>{t('companies.sectionColumnDescription')}</th>
              </tr>
            </thead>
            <tbody>
              {COMPANY_SECTIONS.map((section) => (
                // A linha toda abre ao clicar; o nome é o link, para o teclado
                <tr
                  key={section.key}
                  className="Section_Row"
                  onClick={() => navigate(`/Companies/${company.slug}/${section.path}`)}
                >
                  <td className="Section_Name">
                    <Link to={`/Companies/${company.slug}/${section.path}`} onClick={(e) => e.stopPropagation()}>
                      {t(section.titleKey)}
                    </Link>
                  </td>
                  <td>{t(section.descriptionKey)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Company_Dashboard;
