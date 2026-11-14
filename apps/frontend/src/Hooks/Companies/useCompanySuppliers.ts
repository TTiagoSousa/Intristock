import { End_Points } from '../../Service/endPoints';
import { usePaginatedResource } from '../usePaginatedResource';

export interface CompanySupplier {
  id: string;
  companyId: string;
  name: string;
  // "iq-capital" — o que aparece no URL da página do fornecedor
  slug: string;
  type: 'company' | 'individual' | 'partnership';
  alias: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  taxNumber: string | null;
  contact: string | null;
  email: string | null;
  website: string | null;
  details: string | null;
  isActive: boolean;
  paymentMethod: 'bank_account' | 'direct';
  createdAt: string;
  updatedAt: string;
  group: { id: string; name: string } | null;
  country: { id: string; name: string; emoji: string | null } | null;
  currency: { id: string; shortCode: string; symbol: string } | null;
  bankAccount: { id: string; name: string } | null;
  // A plataforma do catálogo de onde veio (uma prop firm…); nula nos criados à mão
  platform: { id: string; name: string; type: string; logo: string | null } | null;
  // Telefones extra; o principal está no `contact`
  phones: CompanySupplierPhone[];
}

export interface CompanySupplierPhone {
  id: string;
  label: string | null;
  number: string;
}

/**
 * Os fornecedores da empresa, para a **tabela**: dez por página, e a página 2
 * vai buscar os dez seguintes ao servidor.
 *
 * Para encher um dropdown usa-se o `useCompanySupplierOptions` — dez opções
 * numa lista de escolha só deixariam escolher dez.
 */
export const useCompanySuppliers = (companyId: string | undefined) => {
  const list = usePaginatedResource<CompanySupplier>(
    companyId ? End_Points.Company_Suppliers_Endpoint(companyId) : undefined,
  );

  return {
    suppliers: list.items,
    total: list.total,
    page: list.page,
    setPage: list.setPage,
    totalPages: list.totalPages,
    pageSize: list.pageSize,
    loading: list.loading,
    loadingPage: list.loadingPage,
    refresh: list.refresh,
  };
};
