import { End_Points } from '../../Service/endPoints';
import { usePaginatedResource } from '../usePaginatedResource';
import { useCompanyItemMutations } from './useCompanyItemMutations';

export type CompanyItemType = 'product' | 'service';
export type CompanyItemRecurrencePeriod = 'monthly' | 'yearly';

// O que acontece quando se compra um item destes:
//   expense — consome-se de imediato (avença, eletricidade). Não deixa rasto.
//   stock   — passa a haver quantidade em mão (filamento). Gera movimentos.
//   asset   — é imobilizado (a impressora). Gera um registo de ativo.
export const COMPANY_ITEM_KINDS = ['expense', 'stock', 'asset'] as const;
export type CompanyItemKind = (typeof COMPANY_ITEM_KINDS)[number];

// Unidades em que o stock se conta. Diferente de ITEM_UNITS, que é a unidade
// em que se COMPRA: compram-se bobines (pack) e contam-se gramas (g).
export const STOCK_UNITS = ['unit', 'g', 'kg', 'ml', 'litre', 'metre'] as const;
export type StockUnit = (typeof STOCK_UNITS)[number];

// Lista fechada, igual à do backend. Em texto livre, "mês"/"Mês"/"meses"
// seriam valores diferentes e nada seria agrupável por unidade.
export const ITEM_UNITS = [
  'unit',
  'hour',
  'day',
  'month',
  'year',
  'kg',
  'litre',
  'metre',
  'pack',
  'box',
] as const;

export type ItemUnit = (typeof ITEM_UNITS)[number];

export interface CompanyItem {
  id: string;
  companyId: string;
  name: string;
  // "filamento-pla" — o que aparece no URL da página do item
  slug: string;
  description: string | null;
  type: CompanyItemType;
  kind: CompanyItemKind;
  unit: ItemUnit | null;
  stockUnit: StockUnit | null;
  // Quanto stock traz cada unidade comprada — string, como todos os Decimal
  stockPerUnit: string | null;
  // O Prisma serializa Decimal como string — nunca assumir number aqui
  defaultPrice: string | null;
  isRecurring: boolean;
  recurrencePeriod: CompanyItemRecurrencePeriod | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Os fornecedores que vendem o item — um item pode ter vários
  suppliers: { id: string; name: string }[];
  currency: { id: string; shortCode: string; symbol: string } | null;
}

export interface CompanyItemPayload {
  name?: string;
  type?: CompanyItemType;
  kind?: CompanyItemKind;
  stockUnit?: StockUnit | '';
  stockPerUnit?: number;
  description?: string;
  unit?: ItemUnit | '';
  defaultPrice?: number;
  // A lista inteira — substitui as ligações que estavam
  supplierIds?: string[];
  isRecurring?: boolean;
  recurrencePeriod?: CompanyItemRecurrencePeriod | '';
  isActive?: boolean;
}

// companyId é o uuid da empresa — o slug do URL não serve para a API
export const useCompanyItems = (companyId: string | undefined) => {
  // A leitura é paginada pelo servidor: dez por página, e a página 2 vai
  // buscar os dez seguintes. Para encher um dropdown usa-se o
  // `useCompanyItemOptions` — dez opções só deixariam escolher dez.
  const list = usePaginatedResource<CompanyItem>(
    companyId ? End_Points.Company_Items_Endpoint(companyId) : undefined,
  );

  const mutations = useCompanyItemMutations(companyId);

  // Apagar na lista também a volta a carregar, para a linha desaparecer
  const deleteItem = async (itemId: string) => {
    const deleted = await mutations.deleteItem(itemId);

    if (deleted) await list.refresh();

    return deleted;
  };

  return {
    items: list.items,
    page: list.page,
    setPage: list.setPage,
    total: list.total,
    totalPages: list.totalPages,
    pageSize: list.pageSize,
    loadingPage: list.loadingPage,
    loading: list.loading,
    refresh: list.refresh,
    createItem: mutations.createItem,
    updateItem: mutations.updateItem,
    deleteItem,
  };
};
