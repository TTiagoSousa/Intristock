import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Expense_Category, Personal_Product } from '../../../../Hooks/Finances/usePersonalExpense';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Simple_Button from '../../../../Components/Buttons/Simple_Button/Simple_Button';
import { PRODUCT_UNITS, treeOptions } from './expensesShared';
import Popover_Shell from '../../../../Components/Popover_Shell/Popover_Shell';

interface Product_Popover_Props {
  product: Personal_Product | null;
  itemCategories: Expense_Category[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => void;
}

/** Um item do catálogo: o nome, a marca, a unidade e a categoria (em qualquer nível da árvore). */
const Product_Popover = ({ product, itemCategories, saving, error, onClose, onSave }: Product_Popover_Props) => {
  const { t } = useTranslation();
  const [name, setName] = useState(product?.name ?? '');
  const [brand, setBrand] = useState(product?.brand ?? '');
  const [unit, setUnit] = useState(product?.unit ?? '');
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '');

  return (
    <Popover_Shell
      onClose={onClose}
      as="form"
      className="Narrow"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({ name: name.trim(), brand: brand.trim() || null, unit: unit.trim() || null, categoryId: categoryId || null });
      }}
    >
      <div className="Popover_Header">
        <div className="Popover_Header_Text">
          <span className="Popover_Title">{t(product ? 'expenses.itemEditTitle' : 'expenses.itemAddTitle')}</span>
        </div>
        <button type="button" className="Popover_Close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>
      <div className="Popover_Body Single_Column">
        <div className="Form_Field">
          <label htmlFor="product-name">{t('expenses.categoryName')} *</label>
          <Global_Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('expenses.productPlaceholder')} />
        </div>
        <div className="Form_Field">
          <label htmlFor="product-category">{t('expenses.itemCategory')}</label>
          <Global_Dropdown
            id="product-category"
            value={categoryId}
            onChange={(value) => setCategoryId(String(value))}
            options={treeOptions(itemCategories, t('expenses.noCategory'), categoryId)}
          />
        </div>
        <div className="Form_Field">
          <label htmlFor="product-brand">{t('expenses.brand')}</label>
          <Global_Input id="product-brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </div>
        <div className="Form_Field">
          <label htmlFor="product-unit">{t('expenses.unit')}</label>
          <Global_Dropdown
            id="product-unit"
            value={unit}
            onChange={(value) => setUnit(String(value))}
            options={[
              { value: '', label: t('expenses.noUnit') },
              ...PRODUCT_UNITS.map((code) => ({ value: code, label: t(`expenses.units.${code}`) })),
              ...(unit && !(PRODUCT_UNITS as readonly string[]).includes(unit) ? [{ value: unit, label: unit }] : []),
            ]}
          />
        </div>
        {error && <span className="Field_Hint Earnings_Error">{error}</span>}
      </div>
      <div className="Popover_Footer">
        <div className="Form_Action">
          <Simple_Button text={t('common.cancel')} onClick={onClose} variant="Ghost" />
        </div>
        <div className="Form_Action">
          <Simple_Button type="submit" text={t('common.save')} disabled={saving || !name.trim()} />
        </div>
      </div>
    </Popover_Shell>
  );
};

export default Product_Popover;
