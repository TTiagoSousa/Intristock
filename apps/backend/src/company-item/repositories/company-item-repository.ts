import { CompanyItem } from 'src/generated/prisma/client/client';

export type CompanyItemWithRelations = CompanyItem & {
  // Os fornecedores que vendem o item, pela ordem em que foram ligados
  suppliers: { id: string; name: string }[];
};

export interface CompanyItemData {
  name?: string;
  slug?: string;
  type?: string;
  kind?: string;
  stockUnit?: string | null;
  stockPerUnit?: number | null;
  description?: string;
  unit?: string;
  // `null` limpa o campo: é o que acontece quando um item deixa de ser recorrente
  defaultPrice?: number | null;
  // A lista inteira: substitui as ligações que existiam
  supplierIds?: string[];
  isRecurring?: boolean;
  recurrencePeriod?: string | null;
  isActive?: boolean;
}

export interface CompanyItemRepository {
  create(
    data: CompanyItemData & { companyId: string; slug: string },
  ): Promise<CompanyItemWithRelations>;
  update(id: string, data: CompanyItemData): Promise<CompanyItemWithRelations>;
  findById(id: string): Promise<CompanyItem | null>;
  findByCompanyAndName(
    companyId: string,
    name: string,
  ): Promise<CompanyItem | null>;
  findBySlug(
    companyId: string,
    slug: string,
  ): Promise<CompanyItemWithRelations | null>;
  findAllByCompanyId(companyId: string): Promise<CompanyItemWithRelations[]>;
  countPaymentLines(itemId: string): Promise<number>;
  delete(id: string): Promise<void>;
}
