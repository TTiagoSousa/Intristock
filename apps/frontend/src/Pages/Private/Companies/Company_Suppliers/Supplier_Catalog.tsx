import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Icon from '../../../../Imports/icons';
import {
  AVAILABLE_CATALOG_CATEGORIES,
  SUPPLIER_CATALOG_CATEGORIES,
  useSupplierCatalog,
  type Supplier_Catalog_Category,
  type Supplier_Catalog_Entry,
  type Supplier_Catalog_Supplier,
} from '../../../../Hooks/Companies/useSupplierCatalog';
import './Supplier_Catalog.scss';

interface Supplier_Catalog_Props {
  companyId: string;
  // Um fornecedor criado (ou um que já existia): abre a página dele
  onOpen?: (supplier: Supplier_Catalog_Supplier) => void;
  // Em vez de criar o fornecedor, só escolhe a firma (os itens: os planos dela)
  onPickPlatform?: (entry: Supplier_Catalog_Entry) => void;
}

/**
 * «Do catálogo» no popover de um fornecedor novo: primeiro a categoria, depois
 * a lista dela com pesquisa. Escolher uma cria o fornecedor com os dados dela.
 */
const Supplier_Catalog = ({ companyId, onOpen, onPickPlatform }: Supplier_Catalog_Props) => {
  const { t } = useTranslation();
  const [category, setCategory] = useState<Supplier_Catalog_Category | null>(null);
  const [search, setSearch] = useState('');
  const { entries, loading, creating, error, createFromPlatform } = useSupplierCatalog(companyId, category);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? entries.filter((entry) => entry.name.toLowerCase().includes(term)) : entries;
  }, [entries, search]);

  if (!category)
    return (
      <div className="Supplier_Catalog">
        <span className="Supplier_Catalog_Hint">{t('suppliers.catalogHint')}</span>
        <div className="Supplier_Catalog_Categories">
          {SUPPLIER_CATALOG_CATEGORIES.map((option) => {
            const available = AVAILABLE_CATALOG_CATEGORIES.includes(option);
            return (
              <button
                key={option}
                type="button"
                className="Supplier_Catalog_Category"
                disabled={!available}
                onClick={() => setCategory(option)}
              >
                <span className="Supplier_Catalog_Category_Name">{t(`suppliers.catalog_${option}`)}</span>
                <span className="Supplier_Catalog_Category_Text">
                  {available ? t(`suppliers.catalog_${option}_text`) : t('suppliers.catalogSoon')}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );

  const pick = async (entry: Supplier_Catalog_Entry) => {
    if (onPickPlatform) return onPickPlatform(entry);
    if (entry.supplier) return onOpen?.(entry.supplier);
    const created = await createFromPlatform(entry.id);
    if (created) onOpen?.(created);
  };

  return (
    <div className="Supplier_Catalog">
      <div className="Supplier_Catalog_Bar">
        <button type="button" className="Supplier_Catalog_Back" onClick={() => setCategory(null)}>
          <Icon.Chevron_Left />
          <span>{t(`suppliers.catalog_${category}`)}</span>
        </button>
        <input
          className="Supplier_Catalog_Search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          // No popover está dentro do formulário: o Enter não o grava
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          placeholder={t('common.search')}
          aria-label={t('common.search')}
          autoFocus
        />
      </div>

      {error && <span className="Supplier_Catalog_Error">{error}</span>}

      <div className="Supplier_Catalog_List" aria-busy={loading}>
        {!loading && !visible.length && (
          <span className="Supplier_Catalog_Empty">{t('suppliers.catalogEmpty')}</span>
        )}
        {visible.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="Supplier_Catalog_Row"
            disabled={creating !== null}
            onClick={() => pick(entry)}
          >
            <span className="Supplier_Catalog_Logo">
              {entry.logo ? <img src={entry.logo} alt="" loading="lazy" /> : entry.name.slice(0, 1)}
            </span>
            <span className="Supplier_Catalog_Row_Text">
              <span className="Supplier_Catalog_Row_Name">{entry.name}</span>
              {entry.country && <span className="Supplier_Catalog_Row_Meta">{entry.country}</span>}
            </span>
            <span className="Supplier_Catalog_Row_State">
              {creating === entry.id
                ? t('common.saving')
                : onPickPlatform
                  ? t('items.catalogPlans')
                  : entry.supplier
                  ? t('suppliers.catalogAdded')
                  : t('suppliers.catalogAdd')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Supplier_Catalog;
