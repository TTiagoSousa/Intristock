import { Platform, PlatformPlan, PropFirmDetail } from 'src/generated/prisma/client/client';
import { PropFirmRules, PropFirmSummary } from '../helpers/mapPropFirm';

// Um plano que vem de uma API (as colunas da `PlatformPlan` sem as da base)
export interface ExternalPlanData {
  externalKey: string;
  step: string | null;
  name: string | null;
  accountSize: number | null;
  price: number | null;
  currency: string | null;
  activationFee: number | null;
  profitTargetPct: number | null;
  maxDailyLossPct: number | null;
  maxTotalDrawdownPct: number | null;
  drawdownModel: string | null;
  minTradeDays: number | null;
  consistencyPct: number | null;
  profitSplitPct: number | null;
  status: string | null;
  stale: boolean;
}

// O que o atualizar das prop firms lê e escreve
export interface ExternalPlatformData {
  name: string;
  type: string;
  website: string | null;
  logo: string | null;
  countryId: string | null;
  isActive: boolean;
  source: string;
  externalId: string;
  syncedAt: Date;
}

export interface PlatformRepository {
  create(data: {
    name: string;
    type: string;
    logo?: string;
    website?: string;
    countryId?: string;
    isActive?: boolean;
  }): Promise<Platform>;
  findAll(): Promise<Platform[]>;
  findById(id: string): Promise<Platform | null>;
  findByType(type: string): Promise<Platform[]>;
  createExternal(data: ExternalPlatformData): Promise<Platform>;
  updateExternal(id: string, data: Partial<ExternalPlatformData>): Promise<Platform>;
  saveSummary(platformId: string, summary: PropFirmSummary): Promise<void>;
  saveRules(platformId: string, rules: PropFirmRules): Promise<void>;
  replacePlans(platformId: string, plans: ExternalPlanData[]): Promise<void>;
  findWithPlans(
    id: string,
  ): Promise<(Platform & { plans: PlatformPlan[]; propFirm: PropFirmDetail | null }) | null>;
  findByTypeWithPlanCount(
    type: string,
  ): Promise<(Platform & { propFirm: PropFirmDetail | null; _count: { plans: number } })[]>;
  findByTypeWithCountry(
    type: string,
  ): Promise<(Platform & { country: { name: string; iso2: string } | null })[]>;
  sourceStats(
    type: string,
    source: string,
  ): Promise<{ total: number; fromSource: number; plans: number; lastSyncedAt: Date | null }>;
}
