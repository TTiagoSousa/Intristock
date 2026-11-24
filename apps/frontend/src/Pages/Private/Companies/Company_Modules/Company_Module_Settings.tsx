import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompany } from '../../../../Contexts/Company_Context';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import { useCompanyModules } from '../../../../Hooks/Companies/useCompanyModules';
import { MODULE_ICONS, MODULE_PATHS } from './moduleCatalog';
import * as Icon from '../../../../Imports/icons';
import { companyAreas } from '../../../../Containers/Navs/Navigation_Home/Menu_Itins';
import './Company_Modules.scss';

/**
 * As definições de um módulo da empresa (Módulos → Definições). Por agora
 * nenhum tem: a página diz o estado e leva à área do módulo; cada módulo que
 * ganhe opções põe-nas aqui.
 */
const Company_Module_Settings = () => {
  const { slug, moduleName } = useParams();
  const { t } = useTranslation();
  const { company, loading: loadingCompany } = useCompany();
  const { catalog, loading, isModuleActive } = useCompanyModules(company?.id);

  const module = catalog.find((item) => item.name === moduleName);
  const label = module ? t(`modules.catalog.${module.name}.label`, { defaultValue: module.label }) : undefined;

  useBreadcrumbSegmentLabel(slug, company?.name);
  useBreadcrumbSegmentLabel(moduleName, label);

  if (loadingCompany || loading) {
    return (
      <div className="Company_Modules">
        <span className="Modules_Message">{t('common.loading')}</span>
      </div>
    );
  }

  if (!company || !module) {
    return (
      <div className="Company_Modules">
        <span className="Modules_Message">{t(company ? 'modules.notFound' : 'companies.notFound')}</span>
      </div>
    );
  }

  const Module_Icon = MODULE_ICONS[module.icon ?? ''] ?? Icon.Company;
  const active = isModuleActive(module.id);
  const areaPath = MODULE_PATHS[module.name];
  // Um módulo com espaço próprio abre-o noutro separador, como em «Módulos» na barra
  const workspace = companyAreas.find((area) => area.moduleName === module.name)?.workspace;

  return (
    <div className="Company_Modules">
      <div className="Card Module_Settings_Card">
        <div className="Card_Header Module_Settings_Head">
          <div className="Module_Icon">
            <Module_Icon />
          </div>
          <div className="Card_Header_Text">
            <span className="Card_Title">{t('modules.settingsTitle', { name: label })}</span>
            <span className="Card_Subtitle">
              {module.description
                ? t(`modules.catalog.${module.name}.description`, { defaultValue: module.description })
                : ''}
            </span>
          </div>
          <span className={`Pill ${active ? 'Ok' : ''}`}>
            <span className="Dot" />
            {t(active ? 'modules.statusActive' : 'modules.statusInactive')}
          </span>
        </div>

        <div className="Module_Settings_Body">
          <div className="Empty_State">
            <span className="Empty_State_Title">{t('modules.noSettings')}</span>
            <span className="Empty_State_Text">
              {t(active ? 'modules.noSettingsHint' : 'modules.noSettingsOffHint')}
            </span>
            {active && workspace && (
              <a className="Module_Settings_Link" href={workspace(company.slug)} target="_blank" rel="noopener">
                {t('modules.openArea', { name: label })}
              </a>
            )}
            {active && !workspace && areaPath && (
              <Link className="Module_Settings_Link" to={`/Companies/${company.slug}/${areaPath}`}>
                {t('modules.openArea', { name: label })}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Company_Module_Settings;
