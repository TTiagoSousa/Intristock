import { CompanyAsset } from 'src/generated/prisma/client/client';

export type CompanyAssetWithRelations = CompanyAsset & {
  currency: { id: string; shortCode: string; symbol: string } | null;
  item: { id: string; name: string } | null;
  payment: { id: string; reference: string | null; paymentDate: Date } | null;
};

export interface CompanyAssetData {
  name?: string;
  category?: string;
  acquisitionDate?: Date;
  acquisitionValue?: number;
  currencyId?: string;
  depreciationRate?: number;
  usefulLifeHours?: number | null;
  residualValue?: number | null;
  paymentId?: string | null;
  itemId?: string | null;
  status?: string;
  disposedAt?: Date | null;
  disposalValue?: number | null;
  notes?: string | null;
}

export interface CompanyAssetRepository {
  create(data: CompanyAssetData & { companyId: string }): Promise<CompanyAssetWithRelations>;
  update(id: string, data: CompanyAssetData): Promise<CompanyAssetWithRelations>;
  findById(id: string): Promise<CompanyAsset | null>;
  findAllByCompanyId(companyId: string): Promise<CompanyAssetWithRelations[]>;
  findAllByPaymentId(paymentId: string): Promise<CompanyAsset[]>;
  findPaymentInCompany(paymentId: string, companyId: string): Promise<{ id: string } | null>;
  delete(id: string): Promise<void>;
}
