import { PrismaPlatformRepository } from '../repositories/prisma/prisma-platform-repository';
import { PrismaCountryRepository } from 'src/country/repositories/prisma/prisma-country-repository';
import { fetchCoinGeckoExchanges } from './coinGeckoClient';
import { COUNTRY_ALIASES } from './syncPropFirms';

export const EXCHANGE_TYPE = 'exchange';
export const COINGECKO_SOURCE = 'coingecko';

// Os nomes que a CoinGecko escreve de outra maneira das plataformas do catálogo
const NAME_ALIASES: Record<string, string> = {
  'coinbase exchange': 'coinbase',
};

// Os países que só a CoinGecko escreve assim (os outros como na PropFirmMap)
const EXCHANGE_COUNTRY_ALIASES: Record<string, string> = {
  'isle of man': 'man (isle of)',
  'panama canal zone': 'panama',
};

/**
 * Traz as exchanges de cripto da CoinGecko para as plataformas (`type`
 * `exchange`, `source` `coingecko`): o nome, o site, o logótipo e o país. Só as
 * centralizadas — as que a CoinGecko dá com país; as descentralizadas (DEX) não
 * têm e não são uma plataforma onde se abre conta.
 *
 * Encontra cada uma pelo id da API; uma do catálogo ou criada à mão com o mesmo
 * nome passa a ser mantida pela API (e fica com o nome que tinha). As que saíram
 * da API ficam desativadas (pode haver contas a apontar para elas).
 */
export async function syncExchanges(
  config: { url: string; key: string },
  platformRepository: PrismaPlatformRepository,
  countryRepository: PrismaCountryRepository,
) {
  const [all, countries, existing] = await Promise.all([
    fetchCoinGeckoExchanges(config),
    countryRepository.findAll(),
    platformRepository.findByType(EXCHANGE_TYPE),
  ]);
  const exchanges = all.filter((e) => e.country && e.name?.trim());

  const countryByName = new Map(countries.map((c) => [c.name.toLowerCase(), c.id]));
  const countryIdOf = (name: string | null) => {
    if (!name) return null;
    const key = name.toLowerCase();
    return countryByName.get(COUNTRY_ALIASES[key] ?? EXCHANGE_COUNTRY_ALIASES[key] ?? key) ?? null;
  };
  const byExternal = new Map(
    existing
      .filter((p) => p.source === COINGECKO_SOURCE && p.externalId)
      .map((p) => [p.externalId as string, p]),
  );
  const unlinkedByName = new Map(
    existing.filter((p) => !p.externalId).map((p) => [p.name.toLowerCase(), p]),
  );

  const now = new Date();
  const seen = new Set<string>();
  const result = { synced: 0, created: 0, updated: 0, deactivated: 0 };

  for (const exchange of exchanges) {
    if (seen.has(exchange.id)) continue;
    seen.add(exchange.id);
    const name = exchange.name.trim();
    const key = name.toLowerCase();
    const current =
      byExternal.get(exchange.id) ?? unlinkedByName.get(NAME_ALIASES[key] ?? key);
    const data = {
      // O catálogo encontra as suas pelo nome: uma que já existia não muda de nome
      name: current?.name ?? name,
      type: EXCHANGE_TYPE,
      website: exchange.url?.trim() || null,
      logo: exchange.image?.trim() || null,
      countryId: countryIdOf(exchange.country),
      isActive: true,
      source: COINGECKO_SOURCE,
      externalId: exchange.id,
      syncedAt: now,
    };

    if (current) {
      await platformRepository.updateExternal(current.id, data);
      result.updated++;
    } else {
      await platformRepository.createExternal(data);
      result.created++;
    }
    result.synced++;
  }

  for (const platform of byExternal.values()) {
    if (!seen.has(platform.externalId as string) && platform.isActive) {
      await platformRepository.updateExternal(platform.id, { isActive: false });
      result.deactivated++;
    }
  }

  return result;
}
