import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  COMPANY_ITEM_KINDS,
  ITEM_UNITS,
  STOCK_UNITS,
} from '../../../../Hooks/Companies/useCompanyItems';
import type {
  CompanyItemKind,
  CompanyItemRecurrencePeriod,
  CompanyItemType,
  ItemUnit,
  StockUnit,
} from '../../../../Hooks/Companies/useCompanyItems';
import type { Item_Form } from '../../../../Hooks/Companies/useItemForm';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';

export type Item_Field_Name =
  | 'name'
  | 'type'
  | 'kind'
  | 'stockUnit'
  | 'stockPerUnit'
  | 'stockNote'
  | 'supplier'
  | 'unit'
  | 'isRecurring'
  | 'recurrencePeriod'
  | 'defaultPrice'
  | 'description'
  | 'isActive';

// O conjunto do popover de criar. A página escolhe os seus por secção.
const POPOVER_FIELDS: Item_Field_Name[] = [
  'name',
  'type',
  'kind',
  'stockUnit',
  'stockPerUnit',
  'supplier',
  'unit',
  'isRecurring',
  'recurrencePeriod',
  'defaultPrice',
  'description',
  'isActive',
];

// Só os campos pedidos, pela ordem pedida. Os que dependem de outro (stock só
// num item de stock, valor e período só num recorrente) escondem-se sozinhos.
const Item_Form_Fields = ({
  form,
  fields: visible = POPOVER_FIELDS,
}: {
  form: Item_Form;
  fields?: Item_Field_Name[];
}) => {
  const { t } = useTranslation();
  const { values, setValue, suppliers, loadingSuppliers } = form;

  const isStock = values.kind === 'stock';

  const fields: Record<Item_Field_Name, ReactNode> = {
    name: (
      <div className="Form_Field">
        <label htmlFor="item-name">{t('items.columnName')} *</label>
        <Global_Input
          id="item-name"
          value={values.name}
          onChange={(e) => setValue('name', e.target.value)}
          placeholder={t('items.namePlaceholder')}
        />
      </div>
    ),
    type: (
      <div className="Form_Field">
        <label htmlFor="item-type">{t('items.columnType')} *</label>
        <Global_Dropdown
          id="item-type"
          value={values.type}
          onChange={(value) => setValue('type', value as CompanyItemType)}
          options={[
            { value: 'product', label: t('items.type_product') },
            { value: 'service', label: t('items.type_service') },
          ]}
        />
      </div>
    ),
    // O que fica depois de comprar: uma despesa não deixa rasto, o stock passa
    // a ter quantidade, o ativo passa a amortizar
    kind: (
      <div className="Form_Field">
        <label htmlFor="item-kind">{t('items.columnKind')} *</label>
        <Global_Dropdown
          id="item-kind"
          value={values.kind}
          onChange={(value) => setValue('kind', value as CompanyItemKind)}
          options={COMPANY_ITEM_KINDS.map((value) => ({
            value,
            label: t(`items.kind_${value}`),
          }))}
        />
        <span className="Field_Hint">{t(`items.kindHint_${values.kind}`)}</span>
      </div>
    ),
    stockUnit: isStock && (
      <div className="Form_Field">
        <label htmlFor="item-stock-unit">{t('items.stockUnit')} *</label>
        <Global_Dropdown
          id="item-stock-unit"
          value={values.stockUnit}
          onChange={(value) => setValue('stockUnit', value as StockUnit)}
          placeholder={t('items.selectPlaceholder')}
          options={STOCK_UNITS.map((value) => ({
            value,
            label: t(`items.stockUnit_${value}`),
          }))}
        />
        <span className="Field_Hint">{t('items.stockUnitHint')}</span>
      </div>
    ),
    stockPerUnit: isStock && (
      <div className="Form_Field">
        <label htmlFor="item-stock-per-unit">{t('items.stockPerUnit')} *</label>
        <Global_Input
          id="item-stock-per-unit"
          type="number"
          value={values.stockPerUnit}
          onChange={(e) => setValue('stockPerUnit', e.target.value)}
          placeholder="1000"
        />
        <span className="Field_Hint">{t('items.stockPerUnitHint')}</span>
      </div>
    ),
    // Na página, no lugar dos campos de stock quando o item não é de stock —
    // para o separador não ficar vazio sem se perceber porquê
    stockNote: !isStock && (
      <div className="Form_Field Full_Width">
        <span className="Field_Hint">{t('items.stockOnlyForStock')}</span>
      </div>
    ),
    // Vários fornecedores: os ligados em pastilhas, e um dropdown só com os
    // que faltam para acrescentar outro
    supplier: (
      <div className="Form_Field Full_Width">
        <label htmlFor="item-supplier">{t('items.suppliers')}</label>

        {values.supplierIds.length > 0 && (
          <div className="Item_Supplier_Chips">
            {values.supplierIds.map((supplierId) => (
              <span key={supplierId} className="Item_Supplier_Chip">
                {suppliers.find((supplier) => supplier.id === supplierId)?.name ?? '…'}
                <button
                  type="button"
                  onClick={() =>
                    setValue(
                      'supplierIds',
                      values.supplierIds.filter((id) => id !== supplierId),
                    )
                  }
                  title={t('common.delete')}
                  aria-label={t('common.delete')}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <Global_Dropdown
          id="item-supplier"
          value=""
          onChange={(value) => setValue('supplierIds', [...values.supplierIds, value as string])}
          disabled={loadingSuppliers}
          placeholder={t('items.addSupplier')}
          searchable
          options={suppliers
            .filter((supplier) => !values.supplierIds.includes(supplier.id))
            .map((supplier) => ({ value: supplier.id, label: supplier.name }))}
        />
        <span className="Field_Hint">{t('items.suppliersHint')}</span>
      </div>
    ),
    // Lista fechada: em texto livre, "mês"/"Mês"/"meses" seriam valores
    // diferentes e nada seria agrupável
    unit: (
      <div className="Form_Field">
        <label htmlFor="item-unit">{t('items.unit')}</label>
        <Global_Dropdown
          id="item-unit"
          value={values.unit}
          onChange={(value) => setValue('unit', value as ItemUnit)}
          placeholder={t('items.selectPlaceholder')}
          options={ITEM_UNITS.map((value) => ({
            value,
            label: t(`items.unit_${value}`),
          }))}
        />
      </div>
    ),
    isRecurring: (
      <div className="Form_Field">
        <label className="Checkbox_Field" htmlFor="item-is-recurring">
          <input
            id="item-is-recurring"
            type="checkbox"
            checked={values.isRecurring}
            onChange={(e) => setValue('isRecurring', e.target.checked)}
          />
          <span>{t('items.isRecurring')}</span>
        </label>
      </div>
    ),
    // Valor e período só existem em itens recorrentes: é o custo da
    // subscrição. Num produto, o preço real é o de cada compra.
    recurrencePeriod: values.isRecurring && (
      <div className="Form_Field">
        <label htmlFor="item-recurrence-period">{t('items.columnRecurrence')}</label>
        <Global_Dropdown
          id="item-recurrence-period"
          value={values.recurrencePeriod}
          onChange={(value) => setValue('recurrencePeriod', value as CompanyItemRecurrencePeriod)}
          options={[
            { value: 'monthly', label: t('items.recurrence_monthly') },
            { value: 'yearly', label: t('items.recurrence_yearly') },
          ]}
        />
      </div>
    ),
    defaultPrice: values.isRecurring && (
      <div className="Form_Field">
        <label htmlFor="item-default-price">{t('items.periodPrice')}</label>
        <Global_Input
          id="item-default-price"
          type="number"
          value={values.defaultPrice}
          onChange={(e) => setValue('defaultPrice', e.target.value)}
          placeholder={t('items.defaultPricePlaceholder')}
        />
      </div>
    ),
    description: (
      <div className="Form_Field Full_Width">
        <label htmlFor="item-description">{t('items.description')}</label>
        <textarea
          id="item-description"
          className="Form_Textarea"
          value={values.description}
          onChange={(e) => setValue('description', e.target.value)}
          placeholder={t('items.descriptionPlaceholder')}
          rows={3}
        />
      </div>
    ),
    isActive: (
      <div className="Form_Field Full_Width">
        <label className="Checkbox_Field" htmlFor="item-is-active">
          <input
            id="item-is-active"
            type="checkbox"
            checked={values.isActive}
            onChange={(e) => setValue('isActive', e.target.checked)}
          />
          <span>{t('items.isActive')}</span>
        </label>
      </div>
    ),
  };

  return (
    <>
      {visible.map((field) => (
        <Fragment key={field}>{fields[field]}</Fragment>
      ))}
    </>
  );
};

export default Item_Form_Fields;
