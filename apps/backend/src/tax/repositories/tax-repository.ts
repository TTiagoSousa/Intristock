import { Tax } from 'src/generated/prisma/client/client';

export interface TaxRepository {
  create(data: {
    countryId: string;
    name: string;
    description?: string;
    rate: number;
    category: string;
    type: string;
    isActive?: boolean;
  }): Promise<Tax>;
  findById(id: string): Promise<Tax | null>;
  findAll(): Promise<Tax[]>;
  findAllByCountryId(countryId: string): Promise<Tax[]>;
}
