import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlert } from '../../Contexts/Alert_Context';
import { useCompanySupplierOptions } from './useCompanyOptions';
import { useCompanyItemMutations } from './useCompanyItemMutations';
import type {
  CompanyItem,
  CompanyItemKind,
  CompanyItemPayload,
  CompanyItemRecurrencePeriod,
  CompanyItemType,
  ItemUnit,
  StockUnit,
} from './useCompanyItems';

// O segmento do URL da página de criar (…/itens/new-item); os outros são o
// slug do item. O backend não deixa nenhum ficar com ele.
export const NEW_ITEM_SEGMENT = 'new-item';

// Os campos do item, partilhados pelo popover e pela página do item — o
// popover passa-os à página quando se carrega em "Avançadas"
export interface Item_Form_Values {
  name: string;
  type: CompanyItemType;
  kind: CompanyItemKind;
  stockUnit: StockUnit | '';
  // Decimais ficam string enquanto se escreve e só são convertidos no submit
  stockPerUnit: string;
  supplierIds: string[];
  unit: ItemUnit | '';
  defaultPrice: string;
  isRecurring: boolean;
  recurrencePeriod: CompanyItemRecurrencePeriod;
  description: string;
  isActive: boolean;
}

export const initialItemValues = (item?: CompanyItem): Item_Form_Values => ({
  name: item?.name ?? '',
  type: item?.type ?? 'product',
  kind: item?.kind ?? 'expense',
  stockUnit: item?.stockUnit ?? '',
  stockPerUnit: item?.stockPerUnit ?? '',
  supplierIds: item?.suppliers.map((supplier) => supplier.id) ?? [],
  unit: item?.unit ?? '',
  defaultPrice: item?.defaultPrice ?? '',
  isRecurring: item?.isRecurring ?? false,
  recurrencePeriod: item?.recurrencePeriod ?? 'monthly',
  description: item?.description ?? '',
  isActive: item?.isActive ?? true,
});

interface Use_Item_Form_Options {
  companyId: string;
  // Quando vem preenchido, grava-se por cima dele em vez de criar um novo
  item?: CompanyItem;
  initialValues?: Item_Form_Values;
  // Recebe o item gravado — a página precisa do slug, que muda com o nome
  onSaved: (item: CompanyItem) => void;
}

// Estado, validação e gravação do formulário de item, partilhados pelo popover
// e pela página do item (Pages/Private/Companies/Company_Items)
export const useItemForm = ({ companyId, item, initialValues, onSaved }: Use_Item_Form_Options) => {
  const { t } = useTranslation();
  const { setAlert } = useAlert();
  const { createItem, updateItem, saving } = useCompanyItemMutations(companyId);
  const { suppliers, loading: loadingSuppliers } = useCompanySupplierOptions(companyId);

  const [values, setValues] = useState<Item_Form_Values>(
    () => initialValues ?? initialItemValues(item),
  );

  const setValue = <K extends keyof Item_Form_Values>(field: K, value: Item_Form_Values[K]) =>
    setValues((current) => ({ ...current, [field]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (values.name.trim().length < 2) {
      setAlert({ open: true, message: t('items.nameTooShort'), type: 'error' });
      return;
    }

    const trimmedPrice = values.defaultPrice.trim();
    const price = Number(trimmedPrice);
    const hasPrice = trimmedPrice !== '';

    if (hasPrice && (Number.isNaN(price) || price < 0)) {
      setAlert({ open: true, message: t('items.priceInvalid'), type: 'error' });
      return;
    }

    // Um item de stock tem de saber em que unidade conta e quanto traz cada
    // unidade comprada: sem isso, comprar 4 bobines não sabe se são 4 ou 4000
    const isStock = values.kind === 'stock';

    if (isStock && !values.stockUnit) {
      setAlert({ open: true, message: t('items.stockUnitRequired'), type: 'error' });
      return;
    }

    if (isStock && !(Number(values.stockPerUnit) > 0)) {
      setAlert({ open: true, message: t('items.stockPerUnitRequired'), type: 'error' });
      return;
    }

    const payload: CompanyItemPayload = {
      name: values.name.trim(),
      type: values.type,
      kind: values.kind,
      // Fora do stock estes campos são recusados pelo backend
      stockUnit: isStock ? values.stockUnit : '',
      stockPerUnit: isStock ? Number(values.stockPerUnit) : undefined,
      description: values.description.trim(),
      unit: values.unit,
      // Período e valor só são aceites pelo backend em itens recorrentes:
      // num produto o preço real é o da compra, não o do catálogo
      defaultPrice: values.isRecurring && hasPrice ? price : undefined,
      supplierIds: values.supplierIds,
      isRecurring: values.isRecurring,
      recurrencePeriod: values.isRecurring ? values.recurrencePeriod : '',
      isActive: values.isActive,
    };

    const saved = item ? await updateItem(item.id, payload) : await createItem(payload);

    if (saved) onSaved(saved);
  };

  return { values, setValue, submit, saving, suppliers, loadingSuppliers };
};

export type Item_Form = ReturnType<typeof useItemForm>;
