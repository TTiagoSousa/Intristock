import { ApiKeyService } from 'src/api-key/api-key.service';
import { searchMarketplace } from './serpApiMarketplace';
import { autoExclusion, Condition, finishReport, markOutliers, ValuationReport } from './valuationReport';

export type GoodsPriceSearch = {
  query: string;
  location: string;
  radiusKm: number;
  condition?: Condition | null;
  manualValue?: number | null;
  // Os anúncios que a pessoa tirou (ou repôs) numa pesquisa anterior: pelo id, se voltarem a aparecer
  excludedIds?: string[];
  includedIds?: string[];
};

/**
 * Os preços de um bem no Facebook Marketplace (2 pesquisas da SerpApi, com as chaves por
 * ordem): os anúncios à venda e os vendidos à volta da localidade, com as exclusões da regra
 * (peças, baratos demais, outros modelos) e as da pessoa, as estatísticas e o valor do estado.
 */
export async function searchGoodsPrices(search: GoodsPriceSearch, apiKeys: ApiKeyService): Promise<ValuationReport> {
  const params = { query: search.query.trim(), location: search.location.trim(), radiusKm: search.radiusKm };
  const forSale = await apiKeys.run('motorcycle_prices', (key) => searchMarketplace(key, { ...params, sold: false }));
  const sold = await apiKeys.run('motorcycle_prices', (key) => searchMarketplace(key, { ...params, sold: true }));
  const soldIds = new Set(sold.listings.map((listing) => listing.id));
  const mark = (listing: (typeof forSale.listings)[number]) => {
    const reason = autoExclusion(listing.title, listing.price, params.query);
    return { ...listing, excluded: reason ? ('auto' as const) : null, reason };
  };
  // Um anúncio vendido também pode vir na pesquisa dos que estão à venda: conta uma vez
  const forSaleRows = forSale.listings.filter((listing) => !soldIds.has(listing.id)).map(mark);
  // Os muito baratos veem-se contra a mediana das duas listas juntas
  const all = markOutliers([...forSaleRows, ...sold.listings.map(mark)]);
  return finishReport(
    {
      source: 'facebook_marketplace',
      ...params,
      currency: forSale.listings.length ? forSale.currency : sold.currency,
      fetchedAt: new Date().toISOString(),
      forSale: all.slice(0, forSaleRows.length),
      sold: all.slice(forSaleRows.length),
    },
    {
      condition: search.condition ?? 'average',
      manualValue: search.manualValue ?? null,
      excludedIds: search.excludedIds,
      includedIds: search.includedIds,
    },
  );
}
