import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Simple_Button from '../Buttons/Simple_Button/Simple_Button';
import './Record_Page.scss';

export interface Record_Page_Section {
  // Chave de tradução; sem título a secção é só os campos
  title?: string;
  content: ReactNode;
}

interface Record_Page_Props<Tab extends string> {
  title: string;
  // Ativo/inativo ao lado do título
  active: boolean;
  // Ainda por criar: mostra "Por gravar" ao lado do estado
  isNew: boolean;
  tabs: { key: Tab; label: string }[];
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  sections: Record_Page_Section[];
  // Apagar, no fim do separador onde fizer sentido (normalmente Definições)
  danger?: { title: string; hint: string; onDelete: () => void };
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
  // Só para ler (o cargo não deixa editar): sem Guardar e com os campos desligados
  readOnly?: boolean;
}

// A página de um registo (fornecedor, item…), ao jeito do ERPNext: a largura
// toda, título e Guardar em cima, separadores sublinhados, secções com título
// e linha entre elas. Os popovers que os campos abrem ficam de fora — cada um
// tem o seu <form>, e um <form> dentro de outro submetia os dois.
const Record_Page = <Tab extends string>({
  title,
  active,
  isNew,
  tabs,
  activeTab,
  onTabChange,
  sections,
  danger,
  saving,
  onSubmit,
  onCancel,
  readOnly = false,
}: Record_Page_Props<Tab>) => {
  const { t } = useTranslation();

  return (
    <form className="Form_Page Record_Page" onSubmit={onSubmit}>
      <div className="Record_Page_Head">
        <div className="Record_Page_Title">
          <h1>{title}</h1>
          <span className={`Record_Page_Status${active ? ' Active' : ''}`}>
            {t(active ? 'common.active' : 'common.inactive')}
          </span>
          {isNew && <span className="Record_Page_Unsaved">{t('common.notSaved')}</span>}
        </div>

        <div className="Record_Page_Actions">
          <Simple_Button
            text={readOnly ? t('common.back') : t('common.cancel')}
            variant="Ghost"
            small
            auto
            onClick={onCancel}
          />
          {!readOnly && (
            <Simple_Button
              type="submit"
              text={saving ? t('common.saving') : t('common.save')}
              disabled={saving}
              small
              auto
            />
          )}
        </div>
      </div>

      <div className="Record_Page_Tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={activeTab === tab.key ? 'Active' : ''}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="Record_Page_Main">
        {sections.map((section, index) => (
          <section key={section.title ?? index} className="Record_Section">
            {section.title && <h2 className="Record_Section_Title">{t(section.title)}</h2>}
            <fieldset className="Form_Page_Body Record_Fieldset" disabled={readOnly}>
              {section.content}
            </fieldset>
          </section>
        ))}

        {danger && (
          <section className="Record_Section">
            <div className="Record_Danger">
              <div className="Record_Danger_Text">
                <span className="Record_Danger_Title">{danger.title}</span>
                <span className="Field_Hint">{danger.hint}</span>
              </div>
              <Simple_Button text={t('common.delete')} variant="Danger" small auto onClick={danger.onDelete} />
            </div>
          </section>
        )}
      </div>
    </form>
  );
};

export default Record_Page;
