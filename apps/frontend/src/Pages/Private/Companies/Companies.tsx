import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompanies, type Company } from '../../../Hooks/Companies/useCompanies';
import { useCreateCompany, type CreateCompanyPayload } from '../../../Hooks/Companies/useCreateCompany';
import Simple_Button from '../../../Components/Buttons/Simple_Button/Simple_Button';
import Company_Form_Popover from './Company_Form_Popover';
import './Companies.scss';
import { localeOf } from '../../../utils/locale';

/** Iniciais para a marca da empresa: no máximo duas letras. */
const initials = (name: string) =>
  name
    .replace(/[^A-Za-zÀ-ÿ ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

const Companies = () => {
  const { companies, loading, refresh } = useCompanies();
  const { createCompany } = useCreateCompany();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleCreate = async (payload: CreateCompanyPayload) => {
    const created = await createCompany(payload);

    if (created) {
      setIsFormOpen(false);
      // Vai direto para a empresa nova: quem acabou de a criar quer é
      // começar a configurá-la, não voltar à lista
      await refresh();
      navigate(`/Companies/${created.slug}`);
    }
  };

  // O cartão inteiro abre a empresa: sem seta nem link repetido, só o que a
  // distingue das outras (país, empresa mãe, moeda e há quanto tempo existe)
  const renderCard = (company: Company) => (
    <button
      key={company.id}
      className="Company_Card"
      aria-label={`${t('companies.openCompany')}: ${company.name}`}
      onClick={() => navigate(`/Companies/${company.slug}`)}
    >
      <div className="Company_Card_Head">
        <span className="Company_Card_Mark" aria-hidden="true">{initials(company.name)}</span>
        <span className="Company_Card_Identity">
          <span className="Company_Card_Name">{company.name}</span>
          <span className="Company_Card_Country">
            {company.country ? company.country.name : '—'}
          </span>
        </span>
        <span className="Company_Card_Role">
          {t(company.role === 'owner' ? 'companies.roleOwner' : 'companies.roleMember')}
        </span>
      </div>

      {company.parent && (
        <span className="Company_Card_Parent">
          {t('companies.parentCompany', { name: company.parent.name })}
        </span>
      )}

      <span className="Company_Card_Meta Num">
        <span>{company.currency.shortCode}</span>
        <span aria-hidden="true">·</span>
        <span>{t('companies.since', { date: new Date(company.createdAt).toLocaleDateString(localeOf(i18n.language)) })}</span>
      </span>
    </button>
  );

  return (
    <div className="Companies">
      <div className="Page_Head">
        <div>
          <h1>{t('companies.myCompanies')}</h1>
          <div className="Page_Head_Sub">
            {loading ? ' ' : t('companies.count', { count: companies.length })}
          </div>
        </div>

        <div className="Page_Head_Actions">
          <Simple_Button text={t('companies.create')} onClick={() => setIsFormOpen(true)} auto />
        </div>
      </div>

      {loading ? (
        <div className="Empty_State">
          <span className="Empty_State_Text">{t('common.loading')}</span>
        </div>
      ) : companies.length === 0 ? (
        <div className="Empty_State">
          <span className="Empty_State_Title">{t('companies.emptyTitle')}</span>
          <span className="Empty_State_Text">{t('companies.empty')}</span>
          <Simple_Button text={t('companies.create')} onClick={() => setIsFormOpen(true)} auto small />
        </div>
      ) : (
        <div className="Companies_Grid">
          {companies.map(renderCard)}
        </div>
      )}

      {isFormOpen && (
        <Company_Form_Popover
          ownedCompanies={companies.filter((company) => company.role === 'owner')}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
};

export default Companies;
