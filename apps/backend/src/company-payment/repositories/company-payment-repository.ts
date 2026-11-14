import {
  CompanyMember,
  CompanyMemberPay,
  CompanyPayment,
  CompanyPaymentItem,
  CompanyPaymentTax,
} from 'src/generated/prisma/client/client';

export interface CompanyPaymentTaxInput {
  taxId: string;
  calculationType: string;
  rate: number;
  netAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
}

// O `totalPrice` já vem calculado do helper — o repositório não faz contas
export interface CompanyPaymentItemInput {
  itemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export type CompanyPaymentWithLines = CompanyPayment & {
  taxes: CompanyPaymentTax[];
  items: CompanyPaymentItem[];
};

// Uma linha de um item de stock dá entrada; uma de um item de imobilizado
// cria um ativo. Os dois nascem da mesma compra, na mesma transação.
export interface CompanyStockMovementInput {
  itemId: string;
  type: string;
  quantity: number;
  unitCost: number | null;
}

export interface CompanyAssetInput {
  itemId: string;
  name: string;
  category: string;
  acquisitionValue: number;
  depreciationRate: number;
}

// Uma alteração a um pagamento já gravado. Além dos campos, pode levar o
// rasto atrás: concluir um rascunho cria stock e ativos, tirá-lo de concluído
// apaga-os. Tudo na mesma transação.
export interface CompanyPaymentChange {
  data: {
    description?: string;
    reference?: string;
    paymentDate?: Date;
    status?: string;
    supplierId?: string;
    fromBankAccountId?: string;
    toBankAccountId?: string;
    exchangeRate?: number;
    rateSource?: string;
  };
  occurredAt?: Date;
  // A taxa mudou num pagamento concluído: o custo das entradas de stock e o
  // valor dos ativos que ele criou multiplicam-se por isto (taxa nova ÷ antiga)
  rescale?: number;
  clearEffects: boolean;
  effects: { stockMovements: CompanyStockMovementInput[]; assets: CompanyAssetInput[] } | null;
  currencyId: string;
}

export interface CompanyPaymentRepository {
  createWithLines(data: {
    companyId: string;
    paymentType: string;
    partyType: string;
    supplierId?: string;
    memberId?: string;
    memberPayId?: string;
    memberPayPeriod?: string;
    fromBankAccountId?: string;
    toBankAccountId?: string;
    amount: number;
    currencyId: string;
    exchangeRate: number;
    rateSource: string;
    description?: string;
    reference?: string;
    paymentDate: Date;
    status?: string;
    taxes: CompanyPaymentTaxInput[];
    items: CompanyPaymentItemInput[];
  }): Promise<CompanyPaymentWithLines>;
  findMember(companyId: string, memberId: string): Promise<CompanyMember | null>;
  findMemberPay(memberId: string, memberPayId: string): Promise<CompanyMemberPay | null>;
  // Um pagamento não cancelado que já pagou esse período desse salário
  findPaidMemberPeriod(memberPayId: string, period: string): Promise<CompanyPayment | null>;
  findById(id: string): Promise<CompanyPayment | null>;
  // As linhas vêm junto: é delas que se re-derivam o stock e os ativos quando
  // um rascunho passa a concluído
  findByIdWithItems(id: string): Promise<(CompanyPayment & { items: CompanyPaymentItem[] }) | null>;
  updateWithEffects(id: string, change: CompanyPaymentChange): Promise<CompanyPaymentWithLines>;
  findAllByCompanyId(
    companyId: string,
    pagination: { skip: number; take: number },
  ): Promise<PaginatedCompanyPayments>;
  findForMonthlyTotals(
    companyId: string,
    filters: MonthlyTotalsFilters,
  ): Promise<
    Pick<
      CompanyPayment,
      'amount' | 'exchangeRate' | 'paymentDate' | 'paymentType'
    >[]
  >;
  delete(id: string): Promise<void>;
}

// Os filtros do gráfico dos pagamentos por mês
export interface MonthlyTotalsFilters {
  from: Date;
  // O último dia (inclusive)
  until: Date;
  statuses: string[];
  supplierId?: string;
  supplierGroupId?: string;
}

// O total é o número de pagamentos da empresa, não o desta página — é dele que
// o frontend tira quantas páginas existem
export interface PaginatedCompanyPayments {
  items: CompanyPayment[];
  total: number;
}
