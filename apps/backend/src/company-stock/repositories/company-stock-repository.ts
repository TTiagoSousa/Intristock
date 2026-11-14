import { CompanyStockMovement } from 'src/generated/prisma/client/client';

export type StockMovementWithItem = CompanyStockMovement & {
  item: { id: string; name: string; stockUnit: string | null };
};

export interface StockMovementData {
  companyId: string;
  itemId: string;
  type: string;
  quantity: number;
  unitCost?: number | null;
  sourceType: string;
  paymentId?: string | null;
  occurredAt: Date;
  note?: string | null;
}

export interface CompanyStockRepository {
  create(data: StockMovementData): Promise<StockMovementWithItem>;
  createMany(data: StockMovementData[]): Promise<number>;
  findById(id: string): Promise<CompanyStockMovement | null>;
  findAllByCompanyId(companyId: string): Promise<StockMovementWithItem[]>;
  findAllByItemId(companyId: string, itemId: string): Promise<StockMovementWithItem[]>;
  findAllByPaymentId(paymentId: string): Promise<StockMovementWithItem[]>;
  deleteByPayment(paymentId: string): Promise<void>;
  delete(id: string): Promise<void>;
}
