import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCompanies } from '../../../../Hooks/Companies/useCompanies';
import { useCompanySupplier } from '../../../../Hooks/Companies/useCompanySupplier';
import type { CompanySupplier } from '../../../../Hooks/Companies/useCompanySuppliers';
import { useCreateCompanySupplier } from '../../../../Hooks/Companies/useCreateCompanySupplier';
import {
  NEW_SUPPLIER_SEGMENT,
  useSupplierForm,
  type Supplier_Form_Values,
} from '../../../../Hooks/Companies/useSupplierForm';
import { useBreadcrumbSegmentLabel } from '../../../../Contexts/Breadcrumb_Context';
import Record_Page from '../../../../Components/Record_Page/Record_Page';
import Supplier_Form_Fields, { Supplier_Form_Popovers, type Field_Name } from './Supplier_Form_Fields';
import Delete_Supplier_Popover from './Delete_Supplier_Popover';
import Supplier_Catalog from './Supplier_Catalog';
import { useCompany } from '../../../../Contexts/Company_Context';
import './Company_Suppliers.scss';

// O que chega pela navegação ao criar: o que já se tinha escrito no popover, e
// a página para onde voltar no fim (a lista de fornecedores ou os pagamentos)
export interface New_Supplier_State {
  values?: Supplier_Form_Values;
  returnTo?: string;
}

// O que a página devolve a quem a abriu — os pagamentos usam-no para reabrir
// o formulário com o fornecedor novo já escolhido
export interface New_Supplier_Result {
  newSupplierId: string;
}

type Supplier_Tab = 'details' | 'address' | 'accounting' | 'tax' | 'settings' | 'more';

// Cada separador é uma lista de secções; cada secção, um título opcional e os
// seus campos em duas colunas. Um campo novo entra aqui, na secção a que pertence.
const TABS: { key: Supplier_Tab; sections: { title?: string; fields: Field_Name[] }[] }[] = [
  { key: 'details', sections: [{ fields: ['name', 'group', 'type', 'alias'] }] },
  {
    key: 'address',
    sections: [
      { title: 'suppliers.section_address', fields: ['addressLine', 'postalCode', 'city', 'country'] },
      { title: 'suppliers.section_contact', fields: ['contact', 'email'] },
    ],
  },
  {
    key: 'accounting',
    sections: [{ title: 'suppliers.section_defaults', fields: ['bankAccount', 'currency'] }],
  },
  { key: 'tax', sections: [{ title: 'suppliers.section_taxId', fields: ['taxNumber'] }] },
  { key: 'settings', sections: [{ fields: ['isActive'] }] },
  {
    key: 'more',
    sections: [
      { title: 'suppliers.section_phones', fields: ['phones'] },
      { title: 'suppliers.section_other', fields: ['website', 'details'] },
    ],
  },
];

// Página do fornecedor: …/fornecedores/new-supplier cria um novo,
// …/fornecedores/<slug> abre um que já existe para editar
const Company_Supplier = () => {
  const { slug, supplierSlug } = useParams();
  const { t } = useTranslation();
  const { companies, loading: loadingCompanies } = useCompanies();

  const company = companies.find((item) => item.slug === slug);
  const isNew = !supplierSlug;

  const {
    supplier,
    loading: loadingSupplier,
    notFound,
  } = useCompanySupplier(isNew ? undefined : company?.id, supplierSlug);

  useBreadcrumbSegmentLabel(slug, company?.name);
  useBreadcrumbSegmentLabel(supplierSlug, supplier?.name);

  const message = (text: string) => (
    <div className="Company_Suppliers">
      <span className="Company_Suppliers_Message">{text}</span>
    </div>
  );

  if (loadingCompanies) return message(t('common.loading'));
  if (!company) return message(t('companies.notFound'));

  if (!isNew) {
    if (notFound) return message(t('suppliers.notFound'));
    if (loadingSupplier || !supplier) return message(t('common.loading'));
  }

  return (
    <Supplier_Page_Form
      // Outro fornecedor, outro formulário — o estado não passa de um para o outro
      key={supplier?.id ?? NEW_SUPPLIER_SEGMENT}
      companyId={company.id}
      companyName={company.name}
      companySlug={company.slug}
      supplier={supplier ?? undefined}
    />
  );
};

// À parte, para o hook do formulário só arrancar quando a empresa (e, a editar,
// o fornecedor) já chegaram
const Supplier_Page_Form = ({
  companyId,
  companyName,
  companySlug,
  supplier,
}: {
  companyId: string;
  companyName: string;
  companySlug: string;
  supplier?: CompanySupplier;
}) => {
  const { t } = useTranslation();
  const { can } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();

  const state = (location.state ?? {}) as New_Supplier_State;
  const listPath = `/Companies/${companySlug}/compras/fornecedores`;
  const returnTo = state.returnTo ?? listPath;

  const [tab, setTab] = useState<Supplier_Tab>('details');
  // A criar: escrever um novo ou tirá-lo do catálogo (as prop firms…)
  const [mode, setMode] = useState<'new' | 'catalog'>('new');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const { deleteSupplier, loading: deleting } = useCreateCompanySupplier(companyId);

  const form = useSupplierForm({
    companyId,
    supplier,
    initialValues: supplier ? undefined : state.values,
    onSaved: (saved) => {
      if (!supplier) {
        const result: New_Supplier_Result = { newSupplierId: saved.id };
        navigate(returnTo, { state: result });
        return;
      }

      // Um nome novo dá slug novo — o endereço acompanha, sem voltar a carregar
      if (saved.slug !== supplier.slug) {
        navigate(`${listPath}/${saved.slug}`, { replace: true });
      }
    },
  });

  const activeTab = TABS.find((item) => item.key === tab) ?? TABS[0];

  // Um do catálogo: quem abriu a página (os pagamentos) recebe-o já escolhido;
  // vindo da lista, abre a página dele para completar o resto
  const openFromCatalog = (created: { id: string; slug: string }) => {
    if (state.returnTo && state.returnTo !== listPath) {
      const result: New_Supplier_Result = { newSupplierId: created.id };
      navigate(state.returnTo, { state: result });
      return;
    }
    navigate(`${listPath}/${created.slug}`, { replace: true });
  };

  return (
    <div className="Company_Suppliers">
      {!supplier && can('suppliers.create') && (
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
            <span className="Card_Title">{t('suppliers.createTitle')}</span>
          </div>
          <div className="Card_Body">
            <Supplier_Catalog companyId={companyId} onOpen={openFromCatalog} />
          </div>
        </section>
      ) : (
      <Record_Page
        title={supplier ? supplier.name : t('suppliers.createTitle')}
        active={form.values.isActive}
        isNew={!supplier}
        tabs={TABS.map((item) => ({ key: item.key, label: t(`suppliers.tab_${item.key}`) }))}
        activeTab={tab}
        onTabChange={setTab}
        sections={activeTab.sections.map((section) => ({
          title: section.title,
          content: <Supplier_Form_Fields form={form} fields={section.fields} />,
        }))}
        // Apagar só existe para quem já existe. O backend recusa quando há
        // pagamentos ou itens, e o alerta diz para desativar.
        danger={
          tab === 'settings' && supplier && can('suppliers.delete')
            ? {
                title: t('suppliers.deleteTitle'),
                hint: t('suppliers.deleteHint'),
                onDelete: () => setIsDeleteOpen(true),
              }
            : undefined
        }
        saving={form.saving}
        onSubmit={form.submit}
        onCancel={() => navigate(returnTo)}
        readOnly={supplier ? !can('suppliers.edit') : !can('suppliers.create')}
      />
      )}

      <Supplier_Form_Popovers form={form} companyId={companyId} companyName={companyName} />

      {isDeleteOpen && supplier && (
        <Delete_Supplier_Popover
          supplierName={supplier.name}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={async () => {
            if (deleting) return;

            const deleted = await deleteSupplier(supplier.id);
            setIsDeleteOpen(false);

            if (deleted) navigate(listPath);
          }}
        />
      )}
    </div>
  );
};

export default Company_Supplier;
