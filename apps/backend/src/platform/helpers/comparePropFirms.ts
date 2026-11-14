import { PrismaPlatformRepository } from '../repositories/prisma/prisma-platform-repository';
import { PrismaCountryRepository } from 'src/country/repositories/prisma/prisma-country-repository';
import { fetchPropFirmList } from './propFirmMapClient';
import { PropFirmDetail } from 'src/generated/prisma/client/client';
import {
  mapPropFirmBase,
  PROP_FIRM_TYPE,
  PROPFIRM_SOURCE,
} from './mapPropFirm';

export type PropFirmCompareStatus =
  | 'new'
  | 'changed'
  | 'same'
  | 'removed'
  | 'local';

// Os campos que se comparam entre a base e a API (o que se vê na lista)
const FIELDS = [
  'name',
  'website',
  'logo',
  'country',
  'assetType',
  'score',
  'safetyGrade',
  'profitSplit',
] as const;
type Field = (typeof FIELDS)[number];

type Snapshot = Record<Field, string | number | null>;

/**
 * A base contra a API, firma a firma: as novas (só na API), as que mudaram (e
 * em que campos), as iguais, as que saíram da API e as criadas à mão. Lê só a
 * lista da API (6 pedidos), não as fichas.
 */
export async function comparePropFirms(
  config: { url: string },
  platformRepository: PrismaPlatformRepository,
  countryRepository: PrismaCountryRepository,
) {
  const [firms, existing, countries] = await Promise.all([
    fetchPropFirmList(config),
    platformRepository.findByTypeWithPlanCount(PROP_FIRM_TYPE),
    countryRepository.findAll(),
  ]);
  const countryName = new Map(countries.map((c) => [c.id, c.name]));

  const fromDb = (platform: (typeof existing)[number]): Snapshot => {
    const detail = platform.propFirm;
    return {
      name: platform.name,
      website: platform.website,
      logo: platform.logo,
      // Como a API o escreve (o nosso nome do país pode ser outro: "Hong Kong S.A.R.")
      country:
        detail?.countryName ??
        (platform.countryId ? countryName.get(platform.countryId) : null) ??
        null,
      assetType: detail?.assetType ?? null,
      // A nota é decimal na base: em número, para comparar com a da API
      score: detail?.score != null ? Number(detail.score) : null,
      safetyGrade: detail?.safetyGrade ?? null,
      profitSplit: detail?.profitSplit ?? null,
    };
  };

  const byExternal = new Map(
    existing
      .filter((p) => p.source === PROPFIRM_SOURCE && p.externalId)
      .map((p) => [p.externalId as string, p]),
  );
  const seen = new Set<string>();

  const rows = firms.map((firm) => {
    const base = mapPropFirmBase(firm);
    seen.add(base.externalId);
    const api: Snapshot = {
      name: base.name,
      website: base.website,
      logo: base.logo,
      country: base.summary.countryName,
      assetType: base.summary.assetType,
      score: base.summary.score,
      safetyGrade: base.summary.safetyGrade,
      profitSplit: base.summary.profitSplit,
    };
    const platform = byExternal.get(base.externalId);
    if (!platform) {
      return {
        key: `api:${base.externalId}`,
        name: base.name,
        status: 'new' as const,
        diffs: [] as Field[],
        api,
        db: null,
      };
    }
    const db = fromDb(platform);
    const diffs = FIELDS.filter(
      (field) => (api[field] ?? null) !== (db[field] ?? null),
    );
    return {
      key: platform.id,
      name: base.name,
      status: (diffs.length > 0 || !platform.isActive
        ? 'changed'
        : 'same') as PropFirmCompareStatus,
      diffs,
      api,
      db: { ...db, ...dbMeta(platform) },
    };
  });

  for (const platform of existing) {
    const fromApi = platform.source === PROPFIRM_SOURCE && platform.externalId;
    if (fromApi && seen.has(platform.externalId as string)) continue;
    rows.push({
      key: platform.id,
      name: platform.name,
      status: fromApi ? 'removed' : 'local',
      diffs: [],
      api: null as unknown as Snapshot,
      db: { ...fromDb(platform), ...dbMeta(platform) },
    });
  }

  const count = (status: PropFirmCompareStatus) =>
    rows.filter((row) => row.status === status).length;
  return {
    checkedAt: new Date().toISOString(),
    apiCount: firms.length,
    dbCount: existing.length,
    counts: {
      new: count('new'),
      changed: count('changed'),
      same: count('same'),
      removed: count('removed'),
      local: count('local'),
    },
    rows: rows.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function dbMeta(platform: {
  id: string;
  isActive: boolean;
  source: string;
  syncedAt: Date | null;
  propFirm: PropFirmDetail | null;
  _count: { plans: number };
}) {
  const detailsSyncedAt = platform.propFirm?.detailsSyncedAt ?? null;
  return {
    id: platform.id,
    isActive: platform.isActive,
    source: platform.source,
    syncedAt: platform.syncedAt?.toISOString() ?? null,
    detailsSyncedAt: detailsSyncedAt?.toISOString() ?? null,
    // Sem a ficha ainda não se sabe; depois dela, os planos ativos na tabela
    plans: detailsSyncedAt ? platform._count.plans : null,
  };
}
