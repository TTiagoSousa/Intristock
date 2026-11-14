import { CompanySupplier } from 'src/generated/prisma/client/client';

// Os campos que se gravam num fornecedor. Os telefones extra vêm como lista
// inteira e substituem os que existiam.
export interface CompanySupplierData {
  name?: string;
  slug?: string;
  type?: string;
  alias?: string;
  groupId?: string;
  addressLine?: string;
  postalCode?: string;
  city?: string;
  countryId?: string;
  currencyId?: string;
  paymentMethod?: string;
  bankAccountId?: string;
  taxNumber?: string;
  contact?: string;
  email?: string;
  website?: string;
  details?: string;
  isActive?: boolean;
  platformId?: string;
  phones?: { label?: string; number: string }[];
}

export interface CompanySupplierRepository {
  create(
    data: CompanySupplierData & {
      companyId: string;
      name: string;
      slug: string;
      type: string;
    },
  ): Promise<CompanySupplier>;
  update(id: string, data: CompanySupplierData): Promise<CompanySupplier>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<CompanySupplier | null>;
  findBySlug(companyId: string, slug: string): Promise<CompanySupplier | null>;
  findAllByCompanyId(companyId: string): Promise<CompanySupplier[]>;
  countPayments(id: string): Promise<number>;
}
