import { Country } from 'src/generated/prisma/client/client';

export interface CountryRepository {
  upsert(data: {
    apiId: string;
    name: string;
    iso2: string;
    iso3: string;
    phonecode: string;
    capital: string | null;
    currency: string;
    native: string | null;
    emoji: string | null;
  }): Promise<Country>;
  findAll(): Promise<Country[]>;
  findById(id: string): Promise<Country | null>;
}
