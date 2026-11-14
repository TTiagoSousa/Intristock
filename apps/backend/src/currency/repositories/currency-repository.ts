import { Currency } from 'src/generated/prisma/client/client';

export interface CurrencyRepository {
  create(data: {
    name: string;
    shortCode: string;
    code: string;
    precision: number;
    subunit: number;
    symbol: string;
    symbolFirst: boolean;
    decimalMark: string;
    thousandsSeparator: string;
    rate: number;
  }): Promise<Currency>;
  upsert(data: {
    name: string;
    shortCode: string;
    code: string;
    precision: number;
    subunit: number;
    symbol: string;
    symbolFirst: boolean;
    decimalMark: string;
    thousandsSeparator: string;
    rate: number;
  }): Promise<Currency>;
  findAll(): Promise<Currency[]>;
  findByShortCode(shortCode: string): Promise<Currency | null>;
  findById(id: string): Promise<Currency | null>;
  updateRate(id: string, rate: number): Promise<Currency>;
}
