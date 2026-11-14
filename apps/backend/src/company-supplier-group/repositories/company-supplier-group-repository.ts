import { CompanySupplierGroup } from 'src/generated/prisma/client/client';

// Fornecedor "leve" tal como vai dentro de cada grupo nas respostas
export interface CompanySupplierGroupSupplier {
  id: string;
  name: string;
  isActive: boolean;
}

export type CompanySupplierGroupWithSuppliers = CompanySupplierGroup & {
  suppliers: CompanySupplierGroupSupplier[];
};

export interface CompanySupplierGroupRepository {
  create(data: {
    companyId: string;
    name: string;
    description?: string;
  }): Promise<CompanySupplierGroup>;
  update(
    id: string,
    data: {
      name?: string;
      description?: string;
    },
  ): Promise<CompanySupplierGroup>;
  delete(id: string): Promise<CompanySupplierGroup>;
  findById(id: string): Promise<CompanySupplierGroup | null>;
  findByIdWithSuppliers(id: string): Promise<CompanySupplierGroupWithSuppliers | null>;
  findByCompanyIdAndName(companyId: string, name: string): Promise<CompanySupplierGroup | null>;
  findAllByCompanyId(companyId: string): Promise<CompanySupplierGroupWithSuppliers[]>;
  setSuppliers(id: string, supplierIds: string[]): Promise<CompanySupplierGroupWithSuppliers | null>;
  // Usado só para validar que os fornecedores pedidos existem e são da mesma empresa
  findSuppliersByIds(ids: string[]): Promise<{ id: string; companyId: string }[]>;
}
