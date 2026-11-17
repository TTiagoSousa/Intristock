import { PrismaMarketDataRepository } from '../repositories/prisma/prisma-market-data-repository';

// Cada corretora do simulador e a plataforma dela: o nome no catálogo e o id na
// CoinGecko (a Coinbase Exchange ainda tem lá o nome antigo, GDAX)
const SOURCE_PLATFORMS: Record<string, { name: string; coingeckoId: string }> = {
  binance: { name: 'Binance', coingeckoId: 'binance' },
  coinbase: { name: 'Coinbase', coingeckoId: 'gdax' },
};

/**
 * Liga os mercados de uma corretora (`source`) à `Platform` dela, para o
 * simulador mostrar o nome e o logótipo. Sem a plataforma na base (o catálogo
 * ainda não entrou, ou foi apagada) ficam como estão e tenta-se no próximo sync.
 */
export async function linkInstrumentsToPlatform(
  repository: PrismaMarketDataRepository,
  source: string,
) {
  const known = SOURCE_PLATFORMS[source];
  if (!known) return { linked: 0 };

  const platformId = await repository.findExchangePlatformId(known.name, known.coingeckoId);
  if (!platformId) return { linked: 0 };

  return { linked: await repository.linkInstrumentsToPlatform(source, platformId) };
}
