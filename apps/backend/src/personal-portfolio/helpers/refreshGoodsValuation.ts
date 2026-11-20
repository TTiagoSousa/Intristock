import { ApiKeyService } from 'src/api-key/api-key.service';
import { CurrencyService } from 'src/currency/currency.service';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';
import { addGoodsValuation } from './addGoodsValuation';
import { goodsState } from './goodsState';
import { searchGoodsPrices } from './searchGoodsPrices';
import { ReportListing, ValuationReport } from './valuationReport';

const DAY_MS = 86_400_000;
const DEFAULT_LOCATION = 'Lisbon, Portugal';
const DEFAULT_RADIUS_KM = 200;

type GoodsDetails = { searchQuery?: string; brand?: string; model?: string; location?: string; radiusKm?: number };

/**
 * A atualização automática de um bem: a pesquisa de preços com a pesquisa, a localidade e o
 * raio dele, o estado da última pesquisa e os anúncios que a pessoa tirou ou repôs nela, e a
 * avaliação nova com o relatório. Um bem já vendido deixa de se atualizar.
 */
export async function refreshGoodsValuation(
  userId: string,
  assetId: string,
  repository: PrismaPersonalPortfolioRepository,
  apiKeys: ApiKeyService,
  currencyService: CurrencyService,
) {
  const asset = await repository.findGoodsAsset(userId, assetId);
  if (!asset) return null;
  const { transactions, position } = await goodsState(userId, assetId, repository);
  if (position.quantity <= 0) {
    await repository.updateGoodsAsset(assetId, { valuationEveryDays: null, valuationNextAt: null });
    return null;
  }
  const details = (asset.details ?? {}) as GoodsDetails;
  const last = [...transactions].reverse().find((tx) => tx.valuationReport)?.valuationReport as ValuationReport | undefined;
  const marked = (excluded: ReportListing['excluded']) =>
    [...(last?.forSale ?? []), ...(last?.sold ?? [])].filter((row) => row.excluded === excluded).map((row) => row.id);
  // Os que a pessoa repôs: os que a regra tirava e ela deixou a contar
  const included = [...(last?.forSale ?? []), ...(last?.sold ?? [])].filter((row) => !row.excluded && row.reason).map((row) => row.id);

  const report = await searchGoodsPrices(
    {
      query: details.searchQuery || `${details.brand ?? ''} ${details.model ?? ''}`.trim() || asset.name,
      location: details.location || DEFAULT_LOCATION,
      radiusKm: details.radiusKm || DEFAULT_RADIUS_KM,
      condition: last?.condition ?? 'average',
      excludedIds: marked('manual'),
      includedIds: included,
    },
    apiKeys,
  );
  // Sem anúncios que contem, não se inventa um valor: tenta-se no intervalo seguinte
  if (report.chosenValue === null) {
    if (asset.valuationEveryDays)
      await repository.updateGoodsAsset(assetId, { valuationNextAt: new Date(Date.now() + asset.valuationEveryDays * DAY_MS) });
    return null;
  }
  return addGoodsValuation(
    userId,
    assetId,
    { report: report as unknown as Record<string, unknown>, condition: report.condition ?? 'average' },
    repository,
    currencyService,
    'auto',
  );
}
