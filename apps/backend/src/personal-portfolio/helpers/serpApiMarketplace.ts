import { BadRequestException } from '@nestjs/common';
import { ApiKeyUnusableError } from 'src/api-key/helpers/apiKeyProviders';
import { ReportListing } from './valuationReport';

const SERPAPI_SEARCH = 'https://serpapi.com/search.json';
const SERPAPI_LOCATIONS = 'https://serpapi.com/locations.json';

// As localidades da SerpApi estão em inglês: as que se escrevem doutra maneira em português
const PLACE_ALIASES: Record<string, string> = { lisboa: 'Lisbon' };
const placeName = (text: string) =>
  text.replace(/^\s*([^,]+)/, (_, first: string) => PLACE_ALIASES[first.trim().toLowerCase()] ?? first);

type SerpListing = {
  listing_id?: string;
  title?: string;
  name?: string;
  link?: string;
  price?: string;
  extracted_price?: number;
  location?: string;
  listed_at?: string;
  thumbnail?: string;
  is_sold?: boolean;
};

/**
 * Uma pesquisa no Facebook Marketplace pela SerpApi (gasta 1 pesquisa da chave): os anúncios
 * à volta de `location` num raio, à venda ou já vendidos. Os que não dizem preço ficam de
 * fora; "sem resultados" é uma lista vazia. Uma chave esgotada ou recusada levanta
 * `ApiKeyUnusableError` (passa-se à seguinte).
 */
export async function searchMarketplace(
  key: string,
  params: { query: string; location: string; radiusKm: number; sold: boolean },
): Promise<{ listings: Omit<ReportListing, 'excluded' | 'reason'>[]; currency: string }> {
  const url = new URL(SERPAPI_SEARCH);
  url.searchParams.set('engine', 'facebook_marketplace');
  url.searchParams.set('q', params.query);
  url.searchParams.set('location', placeName(params.location));
  url.searchParams.set('radius', String(params.radiusKm));
  if (params.sold) url.searchParams.set('availability', 'sold');
  url.searchParams.set('api_key', key);

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  } catch {
    throw new BadRequestException('A SerpApi não respondeu');
  }
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    organic_results?: SerpListing[];
  };
  if (body.error) {
    if (/run out of searches|searches left|plan limit/i.test(body.error) || response.status === 429)
      throw new ApiKeyUnusableError('Acabaram as pesquisas deste mês', 'exhausted');
    if (/invalid api key/i.test(body.error) || response.status === 401)
      throw new ApiKeyUnusableError('A SerpApi recusou a chave', 'rejected');
    // O Marketplace sem anúncios para a pesquisa não é um erro
    if (/hasn't returned any results/i.test(body.error)) return { listings: [], currency: 'EUR' };
    throw new BadRequestException(`A SerpApi respondeu: ${body.error}`);
  }
  if (!response.ok) throw new BadRequestException(`A SerpApi respondeu ${response.status}`);

  const results = (body.organic_results ?? []).filter(
    (row) => row.listing_id && typeof row.extracted_price === 'number' && (!params.sold || row.is_sold === true),
  );
  // A moeda pelo símbolo do primeiro preço (no Marketplace português, o euro)
  const symbol = results.find((row) => row.price)?.price ?? '€';
  const currency = symbol.includes('£') ? 'GBP' : symbol.includes('$') ? 'USD' : 'EUR';
  return {
    currency,
    listings: results.map((row) => ({
      id: row.listing_id!,
      title: (row.name ?? row.title ?? '').trim(),
      price: row.extracted_price!,
      location: row.location ?? null,
      link: row.link ?? null,
      listedAt: row.listed_at ?? null,
      thumbnail: row.thumbnail ?? null,
    })),
  };
}

/** As localidades da SerpApi que começam pelo texto (não gasta pesquisas nem precisa de chave). */
export async function searchLocations(query: string) {
  const url = new URL(SERPAPI_LOCATIONS);
  url.searchParams.set('q', placeName(query));
  url.searchParams.set('limit', '8');
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new BadRequestException('A SerpApi não respondeu');
  }
  if (!response.ok) throw new BadRequestException(`A SerpApi respondeu ${response.status}`);
  const rows = (await response.json().catch(() => [])) as { canonical_name?: string; target_type?: string; country_code?: string }[];
  // O Marketplace procura à volta de uma cidade ou região: o nome inteiro, sem repetidos
  const names = [...new Set(rows.flatMap((row) => (row.canonical_name ? [row.canonical_name.replace(/,/g, ', ')] : [])))];
  return names.map((name) => ({ name }));
}
