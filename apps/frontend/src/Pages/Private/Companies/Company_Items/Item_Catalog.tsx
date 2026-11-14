import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Icon from '../../../../Imports/icons';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import { useItemCatalog } from '../../../../Hooks/Companies/useItemCatalog';
import type { Supplier_Catalog_Entry } from '../../../../Hooks/Companies/useSupplierCatalog';
import Supplier_Catalog from '../Company_Suppliers/Supplier_Catalog';

interface Item_Catalog_Props {
  companyId: string;
  // Os itens entraram: quantos
  onAdded: (count: number) => void;
}

/**
 * «Do catálogo» num item novo: a categoria e a firma (o mesmo catálogo dos
 * fornecedores) e depois os planos dela, a escolher um a um ou todos. Cada plano
 * passa a ser um item, ligado ao fornecedor da firma.
 */
const Item_Catalog = ({ companyId, onAdded }: Item_Catalog_Props) => {
  const [platform, setPlatform] = useState<Supplier_Catalog_Entry | null>(null);

  if (!platform) return <Supplier_Catalog companyId={companyId} onPickPlatform={setPlatform} />;
  return (
    <Item_Catalog_Plans
      // Outra firma, outra escolha
      key={platform.id}
      companyId={companyId}
      platform={platform}
      onBack={() => setPlatform(null)}
      onAdded={onAdded}
    />
  );
};

const Item_Catalog_Plans = ({
  companyId,
  platform,
  onBack,
  onAdded,
}: {
  companyId: string;
  platform: Supplier_Catalog_Entry;
  onBack: () => void;
  onAdded: (count: number) => void;
}) => {
  const { t, i18n } = useTranslation();
  const { plans, loading, error, saving, createFromPlans } = useItemCatalog(companyId, platform.id);
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const open = useMemo(() => plans.filter((plan) => !plan.item), [plans]);
  const allChosen = open.length > 0 && open.every((plan) => chosen.has(plan.id));

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const price = (value: number | null, currency: string | null) =>
    value == null
      ? '—'
      : `${value.toLocaleString(i18n.language, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency ?? ''}`.trim();

  const add = async () => {
    const created = await createFromPlans([...chosen]);
    if (created !== null) onAdded(created);
  };

  return (
    <div className="Supplier_Catalog">
      <div className="Supplier_Catalog_Bar">
        <button type="button" className="Supplier_Catalog_Back" onClick={onBack}>
          <Icon.Chevron_Left />
          <span>{platform.name}</span>
        </button>
        {open.length > 0 && (
          <label className="Item_Catalog_All">
            <input
              type="checkbox"
              checked={allChosen}
              onChange={() => setChosen(allChosen ? new Set() : new Set(open.map((plan) => plan.id)))}
            />
            {t('items.catalogAll')}
          </label>
        )}
      </div>

      <span className="Supplier_Catalog_Hint">{t('items.catalogHint')}</span>
      {error && <span className="Supplier_Catalog_Error">{error}</span>}

      <div className="Supplier_Catalog_List" aria-busy={loading}>
        {!loading && !plans.length && <span className="Supplier_Catalog_Empty">{t('items.catalogEmpty')}</span>}
        {plans.map((plan) => (
          <label key={plan.id} className={`Supplier_Catalog_Row Item_Catalog_Row ${plan.item ? 'Taken' : ''}`}>
            <input
              type="checkbox"
              checked={Boolean(plan.item) || chosen.has(plan.id)}
              disabled={Boolean(plan.item) || saving}
              onChange={() => toggle(plan.id)}
            />
            <span className="Supplier_Catalog_Row_Text">
              <span className="Supplier_Catalog_Row_Name">{plan.name}</span>
              {plan.item && <span className="Supplier_Catalog_Row_Meta">{t('items.catalogAdded')}</span>}
            </span>
            <span className="Item_Catalog_Price Num">{price(plan.price, plan.currency)}</span>
          </label>
        ))}
      </div>

      <div className="Item_Catalog_Actions">
        <Simple_Button
          text={saving ? t('common.saving') : t('items.catalogAddCount', { count: chosen.size })}
          disabled={!chosen.size || saving}
          onClick={add}
        />
      </div>
    </div>
  );
};

export default Item_Catalog;
