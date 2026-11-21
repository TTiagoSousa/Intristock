import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompanies } from '../../../../Hooks/Companies/useCompanies';
import { useCompanyItem } from '../../../../Hooks/Companies/useCompanyItem';
import type { CompanyItem } from '../../../../Hooks/Companies/useCompanyItems';
import { useCompanyItemMutations } from '../../../../Hooks/Companies/useCompanyItemMutations';
import {
  NEW_ITEM_SEGMENT,
  initialItemValues,
  useItemForm,
  type Item_Form_Values,
} from '../../../../Hooks/Companies/useItemForm';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import Record_Page from '../../../../Components/Record_Page/Record_Page';
import Item_Catalog from './Item_Catalog';
import Item_Form_Fields, { type Item_Field_Name } from './Item_Form_Fields';
import Delete_Item_Popover from './Delete_Item_Popover';
import { useCompany } from '../../../../Contexts/Company_Context';
import './Company_Items.scss';

// O que chega pela navegação ao criar: o que já se tinha escrito no popover, e
// a página para onde voltar no fim (a lista de itens ou os pagamentos)
export interface New_Item_State {
  values?: Item_Form_Values;
  returnTo?: string;
  // Vindo de um pagamento com fornecedor escolhido: o item nasce ligado a ele
  supplierId?: string;
}

// O que a página devolve a quem a abriu — os pagamentos usam-no para reabrir
// o formulário com uma linha já com o item novo
export interface New_Item_Result {
  newItemId: string;
}

type Item_Tab = 'details' | 'stock' | 'purchasing' | 'settings' | 'more';

// Cada separador é uma lista de secções; cada secção, um título opcional e os
// seus campos em duas colunas. Um campo novo entra aqui, na secção a que pertence.
const TABS: { key: Item_Tab; sections: { title?: string; fields: Item_Field_Name[] }[] }[] = [
  { key: 'details', sections: [{ fields: ['name', 'type', 'kind'] }] },
  {
    key: 'stock',
    sections: [{ title: 'items.section_units', fields: ['unit', 'stockUnit', 'stockPerUnit', 'stockNote'] }],
  },
  {
    key: 'purchasing',
    sections: [
      { fields: ['supplier'] },
      { title: 'items.section_recurrence', fields: ['isRecurring', 'recurrencePeriod', 'defaultPrice'] },
    ],
  },
  { key: 'settings', sections: [{ fields: ['isActive'] }] },
  { key: 'more', sections: [{ fields: ['description'] }] },
];

// Página do item: …/itens/new-item cria um novo, …/itens/<slug> abre um que já
// existe para editar
const Company_Item = () => {
  const { slug, itemSlug } = useParams();
  const { t } = useTranslation();
  const { companies, loading: loadingCompanies } = useCompanies();

  const company = companies.find((item) => item.slug === slug);
  const isNew = !itemSlug;

  const { item, loading: loadingItem, notFound } = useCompanyItem(
    isNew ? undefined : company?.id,
    itemSlug,
  );

  useBreadcrumbSegmentLabel(slug, company?.name);
  useBreadcrumbSegmentLabel(itemSlug, item?.name);

  const message = (text: string) => (
    <div className="Company_Items">
      <span className="Company_Items_Message">{text}</span>
    </div>
  );

  if (loadingCompanies) return message(t('common.loading'));
  if (!company) return message(t('companies.notFound'));

  if (!isNew) {
    if (notFound) return message(t('items.notFound'));
    if (loadingItem || !item) return message(t('common.loading'));
  }

  return (
    <Item_Page_Form
      // Outro item, outro formulário — o estado não passa de um para o outro
      key={item?.id ?? NEW_ITEM_SEGMENT}
      companyId={company.id}
      companySlug={company.slug}
      item={item ?? undefined}
    />
  );
};

// À parte, para o hook do formulário só arrancar quando a empresa (e, a editar,
// o item) já chegaram
const Item_Page_Form = ({
  companyId,
  companySlug,
  item,
}: {
  companyId: string;
  companySlug: string;
  item?: CompanyItem;
}) => {
  const { t } = useTranslation();
  const { can } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();

  const state = (location.state ?? {}) as New_Item_State;
  const listPath = `/Companies/${companySlug}/compras/itens`;
  const returnTo = state.returnTo ?? listPath;

  const [tab, setTab] = useState<Item_Tab>('details');
  // A criar: escrever um novo ou juntar os planos de uma firma do catálogo
  const [mode, setMode] = useState<'new' | 'catalog'>('new');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const { deleteItem } = useCompanyItemMutations(companyId);

  const form = useItemForm({
    companyId,
    item,
    initialValues: item
      ? undefined
      : (state.values ??
        (state.supplierId
          ? { ...initialItemValues(), supplierIds: [state.supplierId] }
          : undefined)),
    onSaved: (saved) => {
      if (!item) {
        const result: New_Item_Result = { newItemId: saved.id };
        navigate(returnTo, { state: result });
        return;
      }

      // Um nome novo dá slug novo — o endereço acompanha, sem voltar a carregar
      if (saved.slug !== item.slug) {
        navigate(`${listPath}/${saved.slug}`, { replace: true });
      }
    },
  });

  const activeTab = TABS.find((entry) => entry.key === tab) ?? TABS[0];

  return (
    <div className="Company_Items">
      {!item && can('items.create') && (
        <div className="Tabs Supplier_Form_Mode" role="tablist">
          {(['new', 'catalog'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={mode === option}
              className={mode === option ? 'Active' : ''}
              onClick={() => setMode(option)}
            >
              {t(option === 'new' ? 'suppliers.modeNew' : 'suppliers.modeCatalog')}
            </button>
          ))}
        </div>
      )}

      {mode === 'catalog' ? (
        <section className="Card Supplier_Catalog_Page">
          <div className="Card_Header">
            <span className="Card_Title">{t('items.createTitle')}</span>
          </div>
          <div className="Card_Body">
            {/* Vários itens de uma vez: volta para onde se estava, sem nenhum escolhido */}
            <Item_Catalog companyId={companyId} onAdded={() => navigate(returnTo)} />
          </div>
        </section>
      ) : (
      <Record_Page
        title={item ? item.name : t('items.createTitle')}
        active={form.values.isActive}
        isNew={!item}
        tabs={TABS.map((entry) => ({ key: entry.key, label: t(`items.tab_${entry.key}`) }))}
        activeTab={tab}
        onTabChange={setTab}
        sections={activeTab.sections.map((section) => ({
          title: section.title,
          content: <Item_Form_Fields form={form} fields={section.fields} />,
        }))}
        // Apagar só existe para quem já existe. O backend recusa quando o item
        // já entrou numa compra, e o alerta diz para o desativar.
        danger={
          tab === 'settings' && item && can('items.delete')
            ? {
                title: t('items.deleteTitle'),
                hint: t('items.deleteHint'),
                onDelete: () => setIsDeleteOpen(true),
              }
            : undefined
        }
        saving={form.saving}
        onSubmit={form.submit}
        onCancel={() => navigate(returnTo)}
        readOnly={item ? !can('items.edit') : !can('items.create')}
      />
      )}

      {isDeleteOpen && item && (
        <Delete_Item_Popover
          itemName={item.name}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={async () => {
            const deleted = await deleteItem(item.id);
            setIsDeleteOpen(false);

            if (deleted) navigate(listPath);
          }}
        />
      )}

    </div>
  );
};

export default Company_Item;
