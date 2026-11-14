import { CompanyPaymentDocument } from 'src/generated/prisma/client/client';

export interface CompanyPaymentDocumentData {
  paymentId: string;
  fileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  storageProvider: string;
}

export interface CompanyPaymentDocumentRepository {
  create(data: CompanyPaymentDocumentData): Promise<CompanyPaymentDocument>;
  findById(id: string): Promise<CompanyPaymentDocument | null>;
  findAllByPaymentId(paymentId: string): Promise<CompanyPaymentDocument[]>;
  delete(id: string): Promise<void>;
}
