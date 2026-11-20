import { BadRequestException } from '@nestjs/common';
import { GoodsValuationDto } from '../dto/goods.dto';
import { finishReport, ReportListing, ValuationReport } from './valuationReport';

const MAX_LISTINGS = 200;

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : null);

// Um anúncio do relatório que veio do browser: só os campos dele, com os tipos certos
function listingFrom(value: unknown): ReportListing | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const price = Number(row.price);
  const id = text(row.id, 64);
  if (!id || !Number.isFinite(price) || price < 0) return null;
  return {
    id,
    title: text(row.title, 300) ?? '',
    price,
    location: text(row.location, 120),
    link: text(row.link, 500),
    listedAt: text(row.listedAt, 40),
    thumbnail: text(row.thumbnail, 1000),
    excluded: row.excluded === 'auto' || row.excluded === 'manual' ? row.excluded : null,
    reason: text(row.reason, 40),
  };
}

/**
 * O valor de uma avaliação e o relatório que o explica: com um relatório (o de uma pesquisa,
 * com as escolhas da pessoa), as estatísticas refazem-se aqui e o valor é o do estado, ou o
 * escrito à mão; sem relatório, só o valor à mão. Sem nenhum, nulo.
 */
export function resolveGoodsValuation(dto: GoodsValuationDto | undefined): { value: number; report: ValuationReport | null } | null {
  if (!dto) return null;
  const manualValue = dto.manualValue ?? null;
  if (!dto.report) return manualValue === null ? null : { value: manualValue, report: null };

  const raw = dto.report;
  const lists = [raw.forSale, raw.sold].map((list) =>
    Array.isArray(list) ? list.slice(0, MAX_LISTINGS).flatMap((row) => listingFrom(row) ?? []) : [],
  );
  const report = finishReport(
    {
      source: 'facebook_marketplace',
      query: text(raw.query, 80) ?? '',
      location: text(raw.location, 120) ?? '',
      radiusKm: Number(raw.radiusKm) || 0,
      currency: text(raw.currency, 3) ?? 'EUR',
      fetchedAt: text(raw.fetchedAt, 40) ?? new Date().toISOString(),
      forSale: lists[0],
      sold: lists[1],
    },
    { condition: dto.condition ?? 'average', manualValue, excludedIds: dto.excludedIds, includedIds: dto.includedIds },
  );
  if (report.chosenValue === null)
    throw new BadRequestException('A pesquisa não tem anúncios que contem: escreve o valor à mão');
  return { value: report.chosenValue, report };
}
