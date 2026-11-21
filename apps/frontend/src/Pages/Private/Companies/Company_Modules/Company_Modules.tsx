import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompanies } from '../../../../Hooks/Companies/useCompanies';
import { useCompanyModules, type SystemModule } from '../../../../Hooks/Companies/useCompanyModules';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { useCompany } from '../../../../Contexts/Company_Context';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import * as Icon from '../../../../Imports/icons';
import { MODULE_ICONS } from './moduleCatalog';
import './Company_Modules.scss';

type Module_Filter = 'all' | 'active' | 'inactive';

const Company_Modules = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { companies, loading: loadingCompanies } = useCompanies();
  const { t } = useTranslation();
  const { refreshModules, can } = useCompany();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Module_Filter>('all');

  const company = companies.find((item) => item.slug === slug);

  useBreadcrumbSegmentLabel(slug, company?.name);

  const { catalog, loading, togglingId, setModuleActive, isModuleActive } = useCompanyModules(
    company?.id,
  );

  const handleToggle = async (moduleId: string, isActive: boolean) => {
    await setModuleActive(moduleId, isActive);
    // A sidebar lê os módulos do contexto, por isso tem de ser recarregado
    await refreshModules();
  };

  if (loadingCompanies) {
    return (
      <div className="Company_Modules">
        <span className="Modules_Message">{t('common.loading')}</span>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="Company_Modules">
        <span className="Modules_Message">{t('companies.notFound')}</span>
      </div>
    );
  }

  const labelOf = (module: SystemModule) => t(`modules.catalog.${module.name}.label`, { defaultValue: module.label });
  const descriptionOf = (module: SystemModule) =>
    module.description ? t(`modules.catalog.${module.name}.description`, { defaultValue: module.description }) : '';

  // A pesquisa vê o nome e a descrição, como aparecem no ecrã
  const query = search.trim().toLowerCase();
  const matching = catalog.filter(
    (module) => !query || `${labelOf(module)} ${descriptionOf(module)}`.toLowerCase().includes(query),
  );
  const activeCount = catalog.filter((module) => isModuleActive(module.id)).length;
  const visible = matching.filter((module) =>
    filter === 'all' ? true : filter === 'active' ? isModuleActive(module.id) : !isModuleActive(module.id),
  );

  return (
    <div className="Company_Modules">
      {/* O mesmo cabeçalho das outras páginas, com a pesquisa e os filtros nas
          ações; cada módulo é um cartão */}
      <div className="Page_Head">
        <div>
          <h1>{t('modules.title')}</h1>
          <div className="Page_Head_Sub">{t('modules.subtitle')}</div>
        </div>
        <div className="Page_Head_Actions Modules_Head_Filters">
          <div className="Modules_Search">
            <Global_Input
              id="modules-search"
              value={search}
              placeholder={t('modules.search')}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="Tabs">
            {(['all', 'active', 'inactive'] as Module_Filter[]).map((key) => (
              <button
                key={key}
                type="button"
                className={filter === key ? 'Active' : ''} aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {t(`modules.filter_${key}`, {
                  count: key === 'all' ? catalog.length : key === 'active' ? activeCount : catalog.length - activeCount,
                })}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <span className="Modules_Message">{t('common.loading')}</span>
      ) : catalog.length === 0 ? (
        <div className="Empty_State">
          <span className="Empty_State_Title">{t('modules.empty')}</span>
        </div>
      ) : visible.length === 0 ? (
        <div className="Empty_State">
          <span className="Empty_State_Title">{t('modules.noResults')}</span>
        </div>
      ) : (
        <div className="Modules_List">
          {visible.map((module) => {
            const Module_Icon = MODULE_ICONS[module.icon ?? ''] ?? Icon.Company;
            const active = isModuleActive(module.id);
            const isToggling = togglingId === module.id;

            return (
              <div key={module.id} className="Card Module_Card">
                <div className="Module_Icon" aria-hidden="true">
                  <Module_Icon />
                </div>

                <div className="Module_Info">
                  <div className="Module_Title">
                    <span className="Module_Label">{labelOf(module)}</span>
                    <span className={`Pill ${active ? 'Ok' : ''}`}>
                      <span className="Dot" />
                      {t(active ? 'modules.statusActive' : 'modules.statusInactive')}
                    </span>
                  </div>
                  {module.description && <span className="Module_Description">{descriptionOf(module)}</span>}
                </div>

                <div className="Module_Actions">
                  <Simple_Button
                    text={t('modules.settings')}
                    variant="Ghost"
                    small
                    auto
                    onClick={() => navigate(`/Companies/${company.slug}/modulos/${module.name}`)}
                  />

                  {/* Reage no clique e volta sozinho se o pedido falhar; nada aqui
                      muda de tamanho enquanto grava */}
                  <label className="Module_Toggle">
                    <input
                      type="checkbox"
                      checked={active}
                      // Ligar e desligar só com a permissão; os outros só veem
                      disabled={isToggling || !can('modules.edit')}
                      onChange={(e) => handleToggle(module.id, e.target.checked)}
                      aria-label={labelOf(module)}
                    />
                    <span className="Toggle_Track">
                      <span className="Toggle_Thumb"></span>
                    </span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Company_Modules;
