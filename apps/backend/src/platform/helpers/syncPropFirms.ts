import { PrismaPlatformRepository } from '../repositories/prisma/prisma-platform-repository';
import { PrismaCountryRepository } from 'src/country/repositories/prisma/prisma-country-repository';
import {
  fetchPropFirm,
  fetchPropFirmList,
  PropFirmDetail,
} from './propFirmMapClient';
import {
  mapPropFirmBase,
  mapPropFirmDetail,
  PROP_FIRM_TYPE,
  PROPFIRM_SOURCE,
} from './mapPropFirm';

export interface PropFirmSyncProgress {
  phase: 'list' | 'details' | 'done';
  created: number;
  updated: number;
  deactivated: number;
  detailsDone: number;
  detailsTotal: number;
  detailsFailed: number;
}

// A PropFirmMap deixa 60 pedidos por minuto: uma ficha a cada 1,1 s fica por baixo
const DETAIL_DELAY_MS = 1_100;
// Se mesmo assim pedir para abrandar, espera um minuto e tenta outra vez
const RATE_LIMIT_WAIT_MS = 60_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Os países que a PropFirmMap escreve de outra maneira da nossa lista (Country State City)
export const COUNTRY_ALIASES: Record<string, string> = {
  'hong kong': 'hong kong s.a.r.',
  'british virgin islands': 'virgin islands (british)',
  bahamas: 'the bahamas',
};

/**
 * Traz as prop firms da PropFirmMap: primeiro a lista — nome, site, logótipo e
 * país na `Platform` (`type` `prop_firm`, `source` `propfirmmap`), o resumo na
 * `PropFirmDetail` —, depois a ficha de cada uma: as regras e os payouts na
 * `PropFirmDetail` e os planos na `PlatformPlan`.
 *
 * Encontra cada firma pelo id da API; uma criada à mão com o mesmo nome passa a
 * ser mantida pela API. As que saíram da API ficam desativadas (pode haver
 * contas a apontar para elas). As das outras origens não se tocam.
 */
export async function syncPropFirms(
  config: { url: string },
  platformRepository: PrismaPlatformRepository,
  countryRepository: PrismaCountryRepository,
  onProgress: (progress: PropFirmSyncProgress) => void,
) {
  const progress: PropFirmSyncProgress = {
    phase: 'list',
    created: 0,
    updated: 0,
    deactivated: 0,
    detailsDone: 0,
    detailsTotal: 0,
    detailsFailed: 0,
  };
  onProgress({ ...progress });

  const [firms, countries, existing] = await Promise.all([
    fetchPropFirmList(config),
    countryRepository.findAll(),
    platformRepository.findByType(PROP_FIRM_TYPE),
  ]);

  const countryByName = new Map(
    countries.map((c) => [c.name.toLowerCase(), c.id]),
  );
  const countryIdOf = (name: string | null) => {
    if (!name) return null;
    const key = name.toLowerCase();
    return countryByName.get(COUNTRY_ALIASES[key] ?? key) ?? null;
  };
  const byExternal = new Map(
    existing
      .filter((p) => p.source === PROPFIRM_SOURCE && p.externalId)
      .map((p) => [p.externalId as string, p]),
  );
  const unlinkedByName = new Map(
    existing.filter((p) => !p.externalId).map((p) => [p.name.toLowerCase(), p]),
  );

  const now = new Date();
  const seen = new Set<string>();
  const toDetail: { id: string; slug: string }[] = [];

  for (const firm of firms) {
    const base = mapPropFirmBase(firm);
    seen.add(base.externalId);
    const current =
      byExternal.get(base.externalId) ??
      unlinkedByName.get(base.name.toLowerCase());
    const data = {
      name: base.name,
      type: PROP_FIRM_TYPE,
      website: base.website,
      logo: base.logo,
      countryId: countryIdOf(base.summary.countryName),
      isActive: true,
      source: PROPFIRM_SOURCE,
      externalId: base.externalId,
      syncedAt: now,
    };

    const saved = current
      ? await platformRepository.updateExternal(current.id, data)
      : await platformRepository.createExternal(data);
    await platformRepository.saveSummary(saved.id, base.summary);
    if (current) progress.updated++;
    else progress.created++;
    toDetail.push({ id: saved.id, slug: base.slug });
  }

  for (const platform of byExternal.values()) {
    if (!seen.has(platform.externalId as string) && platform.isActive) {
      await platformRepository.updateExternal(platform.id, { isActive: false });
      progress.deactivated++;
    }
  }

  progress.phase = 'details';
  progress.detailsTotal = toDetail.length;
  onProgress({ ...progress });

  for (const item of toDetail) {
    const fetchDetail = () => fetchPropFirm(config, item.slug);
    try {
      let detail: PropFirmDetail;
      try {
        detail = await fetchDetail();
      } catch {
        await sleep(RATE_LIMIT_WAIT_MS);
        detail = await fetchDetail();
      }
      const mapped = mapPropFirmDetail(detail);
      await platformRepository.saveRules(item.id, mapped.rules);
      await platformRepository.replacePlans(item.id, mapped.plans);
    } catch {
      // Uma ficha que falha não para as outras; fica com o resumo e a ficha anterior
      progress.detailsFailed++;
    }
    progress.detailsDone++;
    onProgress({ ...progress });
    await sleep(DETAIL_DELAY_MS);
  }

  progress.phase = 'done';
  onProgress({ ...progress });
  return progress;
}
