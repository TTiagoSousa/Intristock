import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  activeCompanyArea,
  activeModule,
  companyAreaEntry,
  companyAreas,
  companySlugFromPath,
  type Company_Area,
  type Menu_Action,
  type Menu_Section,
} from '../Menu_Itins';
import { useCompany } from '../../../../Contexts/Company_Context';
import { useAuth } from '../../../../Contexts/Auth_Context';
import { useActiveRun } from '../../../../Contexts/Active_Run_Context';
import { useCompanies } from '../../../../Hooks/Companies/useCompanies';
import * as Icon from '../../../../Imports/icons';
import { RUN_VIEW_PARAM, runViewOf } from '../../../../Pages/Private/Trading/Trading_Simulator/runTabs';
import type { Run_Tab } from '../../../../Pages/Private/Trading/Trading_Simulator/runTabs';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import Delete_Simulations_Popover from '../../../../Pages/Private/Trading/Trading_Simulations/Delete_Simulations_Popover';
import Portfolio_Transaction_Popover from '../../../../Pages/Private/Finances/Portfolio/Portfolio_Transaction_Popover';
import './Context_Panel.scss';

// O grupo «Módulos» aberto ou fechado fica no browser (aberto por omissão)
const MODULES_OPEN_KEY = 'intristock-company-modules-open';

const readModulesOpen = () => {
  try {
    return localStorage.getItem(MODULES_OPEN_KEY) !== 'false';
  } catch {
    return true;
  }
};

const saveModulesOpen = (open: boolean) => {
  try {
    localStorage.setItem(MODULES_OPEN_KEY, String(open));
  } catch {
    // sem armazenamento, fica só nesta visita
  }
};

interface Context_Panel_Props {
  // No telemóvel o painel abre por cima do conteúdo e fecha ao navegar
  onNavigate?: () => void;
}

export const Context_Panel = ({ onNavigate }: Context_Panel_Props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { company, activeModules, can } = useCompany();
  // As áreas de um módulo (Trading) só com ele ligado, e cada área e secção só
  // a quem o cargo deixa ver (o backend recusa na mesma)
  const canSee = (item: Company_Area) =>
    (!item.moduleName || activeModules.some((m) => m.module.name === item.moduleName)) &&
    (!item.permissions || can(...item.permissions));
  // Os módulos não ficam soltos: vão dentro do grupo «Módulos»
  const moduleAreas = companyAreas.filter((item) => item.inModules && canSee(item));
  const canManageModules = can('modules.view');
  const visibleAreas = companyAreas.filter(
    (item) =>
      !item.inModules &&
      (item.id === 'modules' ? moduleAreas.length > 0 || canManageModules : canSee(item)),
  );
  const [modulesOpen, setModulesOpen] = useState(readModulesOpen);
  const toggleModules = () => {
    setModulesOpen((open) => {
      saveModulesOpen(!open);
      return !open;
    });
  };
  const { companies } = useCompanies();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [deletingRun, setDeletingRun] = useState<string | null>(null);
  const [openAction, setOpenAction] = useState<Menu_Action | null>(null);
  const activeRunId = useActiveRun();

  const slug = companySlugFromPath(location.pathname);
  const inCompany = Boolean(slug && company);

  const goTo = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  // Uma secção conta como ativa também nos caminhos que ela declara como seus
  // (os que acabam em "/" contam com tudo o que vem a seguir)
  const isSectionActive = (section: Menu_Section) =>
    !section.heading &&
    !section.action &&
    (section.path === location.pathname ||
    section.matchPaths?.some((path) =>
      path.endsWith('/') ? location.pathname.startsWith(path) : path === location.pathname,
    ));

  // `underIcon` distingue as secções de uma ÁREA DE EMPRESA (cujo pai tem
  // ícone, logo o texto começa mais à direita) das secções de um módulo
  // pessoal (cujo pai não tem). O recuo tem de acompanhar, senão o filho
  // aparece à esquerda do texto do pai.
  const sectionButton = (section: Menu_Section, underIcon = false) => (
    <button
      key={section.id}
      type="button"
      className={[
        'Panel_Item',
        underIcon ? 'Sub' : section.nested ? 'Nested' : '',
        isSectionActive(section) ? 'Active' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => (section.action ? setOpenAction(section.action) : goTo(section.path))}
    >
      <span className="Panel_Item_Label">{t(section.labelKey)}</span>
    </button>
  );

  if (inCompany && slug && company) {
    const area = activeCompanyArea(location.pathname, slug);

    return (
      <aside className="Context_Panel">
        <button type="button" className="Panel_Back" onClick={() => goTo('/Companies')}>
          <Icon.Chevron_Left />
          {t('companies.allCompanies')}
        </button>

        <div className="Panel_Company">
          <span className="Panel_Company_Mark">
            {company.name
              .replace(/[^A-Za-zÀ-ÿ ]/g, '')
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((word) => word[0].toUpperCase())
              .join('')}
          </span>
          <span className="Panel_Company_Text">
            <span className="Panel_Company_Name">{company.name}</span>
            <span className="Panel_Company_Tax">
              {company.parent ? `${t('companies.subsidiaryOf')} ${company.parent.name}` : company.country?.name}
            </span>
          </span>
        </div>

        {/* Todas as áreas ficam à vista; só a que está em uso é que abre. Assim
            ir de Compras para Módulos não obriga a voltar ao princípio. */}
        {visibleAreas.map((item) => {
          const isActive = area.id === item.id;

          // «Módulos» abre e fecha a lista ali mesmo; cada módulo abre o dele (o que tem
          // espaço próprio, noutro separador) e «Gerir módulos» leva à página de os ligar
          if (item.id === 'modules') {
            const managing = isActive;
            const open = modulesOpen;

            return (
              <div key={item.id} className="Panel_Group">
                <button
                  type="button"
                  className="Panel_Item Has_Icon"
                  aria-expanded={open}
                  onClick={toggleModules}
                >
                  <span className="Panel_Item_Icon"><item.icon /></span>
                  <span className="Panel_Item_Label">{t(item.labelKey)}</span>
                  <span className={`Panel_Item_Chevron ${open ? 'Open' : ''}`}><Icon.Chevron_Down /></span>
                </button>

                {open && moduleAreas.map((module) =>
                  module.workspace ? (
                    <a
                      key={module.id}
                      className="Panel_Item Sub Panel_Module_Link"
                      href={module.workspace(slug)}
                      target="_blank"
                      rel="noopener"
                      title={t('menu.opensInNewTab')}
                      onClick={() => onNavigate?.()}
                    >
                      <span className="Panel_Item_Label">{t(module.labelKey)}</span>
                      <span className="Panel_Item_External" aria-hidden="true"><Icon.Expand /></span>
                    </a>
                  ) : (
                    <button
                      key={module.id}
                      type="button"
                      className={`Panel_Item Sub ${area.id === module.id ? 'Active' : ''}`}
                      onClick={() => goTo(companyAreaEntry(module, slug, can))}
                    >
                      <span className="Panel_Item_Label">{t(module.labelKey)}</span>
                    </button>
                  ),
                )}

                {open && canManageModules && (
                  <button
                    type="button"
                    className={`Panel_Item Sub Panel_Module_Manage ${managing ? 'Active' : ''}`}
                    onClick={() => goTo(item.path(slug))}
                  >
                    <span className="Panel_Item_Label">{t('menu.manageModules')}</span>
                  </button>
                )}

              </div>
            );
          }
          const sections = (item.sections?.(slug) ?? []).filter(
            (section) => !section.permissions || can(...section.permissions),
          );

          return (
            <div key={item.id} className="Panel_Group">
              <button
                type="button"
                className={`Panel_Item Has_Icon ${isActive && sections.length === 0 ? 'Active' : ''}`}
                onClick={() => goTo(companyAreaEntry(item, slug, can))}
              >
                <span className="Panel_Item_Icon"><item.icon /></span>
                <span className="Panel_Item_Label">{t(item.labelKey)}</span>
              </button>

              {isActive && sections.map((section) => sectionButton(section, true))}
            </div>
          );
        })}
      </aside>
    );
  }

  const item = activeModule(location.pathname);

  // Na página de uma simulação: as vistas dela num grupo por baixo das secções
  // (a página de comparar não é uma simulação)
  const runMatch =
    item.id === 'trading' ? /^\/Trading\/simulacoes\/(?!comparar$)([^/]+)$/.exec(location.pathname) : null;
  // Enquanto corre, a página é só o progresso: as vistas aparecem quando acabar
  const runRunning = Boolean(runMatch && runMatch[1] === activeRunId);
  const runView = runViewOf(location.search);
  const viewButton = (view: Run_Tab, labelKey: string, nested = false, active = runView === view) => (
    <button
      key={view + labelKey}
      type="button"
      className={['Panel_Item', nested ? 'Nested' : '', active ? 'Active' : ''].filter(Boolean).join(' ')}
      onClick={() => goTo(`${location.pathname}${view === 'summary' ? '' : `?${RUN_VIEW_PARAM}=${view}`}`)}
    >
      <span className="Panel_Item_Label">{t(labelKey)}</span>
    </button>
  );

  return (
    <aside className="Context_Panel">
      <div className="Panel_Head">
        <span className="Panel_Title">{t(item.labelKey)}</span>
        <span className="Panel_Hint">{t(item.hintKey)}</span>
      </div>

      {/* Com `.map(sectionButton)` o índice entrava como segundo argumento e
          a partir da segunda secção o recuo saía errado */}
      {item.sections.filter((section) => !section.adminOnly).map((section) => sectionButton(section))}

      {runMatch && !runRunning && (
        <div className="Panel_Group Panel_Group_Spaced">
          <span className="Panel_Group_Label Eyebrow">{t('trading.runPanel')}</span>
          {/* O Settings abre no Geral; o separador do formulário em uso fica marcado por baixo */}
          {viewButton('general', 'trading.runNav_settings', false, false)}
          {viewButton('general', 'trading.tab_general', true)}
          {viewButton('indicators', 'trading.indicators', true)}
          {viewButton('strategy', 'trading.tabStrategy', true)}
          {viewButton('rules', 'trading.tab_rules', true)}
          {viewButton('summary', 'trading.runNav_summary')}
          {viewButton('setup', 'trading.runNav_setup')}
          {viewButton('proofs', 'trading.runNav_proofs')}
          {viewButton('entries', 'trading.runNav_entries')}
          {viewButton('hours', 'trading.runNav_hours')}
          {viewButton('chart', 'trading.runNav_chart')}
          {viewButton('live', 'trading.runNav_live')}

          <div className="Panel_Danger">
            <Simple_Button
              text={t('trading.runDelete')}
              small
              variant="Danger"
              onClick={() => setDeletingRun(runMatch[1])}
            />
          </div>
        </div>
      )}

      {openAction === 'portfolio-transaction' && (
        <Portfolio_Transaction_Popover onClose={() => setOpenAction(null)} />
      )}

      {deletingRun && (
        <Delete_Simulations_Popover
          ids={[deletingRun]}
          onClose={() => setDeletingRun(null)}
          onDeleted={() => {
            setDeletingRun(null);
            goTo('/Trading/simulacoes');
          }}
        />
      )}

      {/* As secções de administração só existem para o admin, num grupo à parte */}
      {isAdmin && item.sections.some((section) => section.adminOnly) && (
        <div className="Panel_Group Panel_Group_Spaced">
          <span className="Panel_Group_Label Eyebrow">{t('menu.administration')}</span>
          {item.sections.filter((section) => section.adminOnly).map((section) => sectionButton(section))}
        </div>
      )}

      {/* Atalho para entrar direto numa empresa, sem passar pela lista */}
      {item.id === 'companies' && companies.length > 0 && (
        <div className="Panel_Group Panel_Group_Spaced">
          <span className="Panel_Group_Label Eyebrow">{t('companies.openCompany')}</span>
          {companies.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="Panel_Item Has_Icon"
              onClick={() => goTo(`/Companies/${entry.slug}`)}
            >
              <span className="Panel_Item_Icon"><Icon.Company /></span>
              <span className="Panel_Item_Label">{entry.name}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
};

export default Context_Panel;
