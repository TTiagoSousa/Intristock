import { AppSetting } from 'src/generated/prisma/client/client';

export interface AppSettingRepository {
  findMany(keys: string[]): Promise<AppSetting[]>;
  upsertMany(entries: { key: string; value: string; encrypted: boolean }[]): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
  countCatalog(): Promise<{ countries: number; currencies: number; exchanges: number; exchangesSyncedAt: string | null }>;
  lastRatesUpdate(): Promise<Date | null>;
}
