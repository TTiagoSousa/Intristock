/**
 * O relatório da pesquisa de preços de um bem (por agora as motas, no Facebook Marketplace pela
 * SerpApi), que fica na avaliação (`valuationReport`): os anúncios à venda e os vendidos, os que
 * não contam e porquê, as estatísticas dos que contam, o estado escolhido e o valor.
 */

/** Um anúncio, como a pesquisa o deu. */
export type ReportListing = {
  id: string;
  title: string;
  price: number;
  location: string | null;
  link: string | null;
  listedAt: string | null;
  thumbnail: string | null;
  // Não conta para as estatísticas: `auto` (a regra) ou `manual` (a pessoa tirou), ou nulo
  excluded: 'auto' | 'manual' | null;
  // A regra que o tirou (`cheap`, `parts`, `other_model`), se foi a regra
  reason: string | null;
};

export type ReportStats = {
  count: number;
  average: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  p10: number | null;
  p25: number | null;
  p75: number | null;
  p90: number | null;
};

// O estado do bem → que ponto dos preços se usa: para restaurar fica nos 10 % mais baratos, como novo nos 10 % mais caros
export const CONDITIONS = ['restore', 'below', 'average', 'above', 'mint'] as const;
export type Condition = (typeof CONDITIONS)[number];
const CONDITION_STAT: Record<Condition, keyof ReportStats> = {
  restore: 'p10',
  below: 'p25',
  average: 'median',
  above: 'p75',
  mint: 'p90',
};

export type ValuationReport = {
  source: 'facebook_marketplace';
  query: string;
  location: string;
  radiusKm: number;
  currency: string;
  fetchedAt: string;
  forSale: ReportListing[];
  sold: ReportListing[];
  // Os que contam: à venda, vendidos e todos
  stats: { forSale: ReportStats; sold: ReportStats; all: ReportStats };
  condition: Condition | null;
  // O valor gravado: o do estado, ou o que a pessoa escreveu (`manual`)
  chosenValue: number | null;
  manual: boolean;
  // Com os anúncios noutra moeda que não a do bem: o valor gravado, já convertido, e a taxa
  converted?: { currency: string; rate: number | null; value: number; estimated: boolean };
};

// Abaixo disto não é uma mota (peças, "1 €" para chamar a atenção)
const MIN_PRICE = 50;
// Peças: só contam antes do nome do modelo ("Motor casal 6v", "Suspensão casal boss"); depois
// dele são da mota ("Casal Boss com motor casal 5")
const PART_WORDS = [
  'motor', 'peca', 'pecas', 'roda', 'rodas', 'deposito', 'suspensao', 'escape', 'cilindro', 'quadro',
  'guarda lamas', 'amortecedor', 'amortecedores', 'escora', 'carburador', 'banco', 'farol', 'pneu',
  'pneus', 'jante', 'jantes', 'kit', 'manete', 'travao', 'embraiagem', 'cambota', 'pistao', 'conjunto', 'conta km', 'conta quilometros', 'montagem',
];
// Em qualquer sítio do título: não é uma mota pronta e com papéis
const ANYWHERE_WORDS = ['projeto', 'projecto', 'para pecas', 'so pecas', 'sem doc', 'sem docs', 'sem documentos', 'sem papeis', 's doc', 's docs'];
// Muito abaixo da mediana dos outros não é o preço da mota (o "123", o "70" de um conta-km)
const OUTLIER_SHARE = 0.35;

// Sem acentos e em minúsculas, para comparar palavras
export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Porque é que um anúncio não conta (ou nulo se conta): barato demais, uma peça ou outro
 * modelo — o título tem de ter todas as palavras da pesquisa ("casal boss" deixa de fora a
 * "Casal Diana").
 */
export function autoExclusion(title: string, price: number, query: string): string | null {
  if (price < MIN_PRICE) return 'cheap';
  const text = ` ${normalize(title)} `;
  const words = normalize(query).split(' ').filter((word) => word.length >= 2);
  if (ANYWHERE_WORDS.some((word) => text.includes(` ${word} `))) return 'parts';
  // O que vem antes da primeira palavra da pesquisa
  const first = words.length ? text.indexOf(` ${words[0]} `) : -1;
  const before = first >= 0 ? text.slice(0, first + 1) : text;
  if (PART_WORDS.some((word) => before.includes(` ${word} `))) return 'parts';
  // As palavras com números (a versão: «V2», «2v», «2 velocidades», «k168») escrevem-se de mil
  // maneiras: só a marca e o modelo, as palavras só com letras, são obrigatórias
  if (words.some((word) => !/\d/.test(word) && !text.includes(` ${word} `))) return 'other_model';
  return null;
}

/**
 * Depois das regras de cada anúncio: os que ficam muito abaixo da mediana dos que contam
 * (menos de `OUTLIER_SHARE` dela) também saem, como baratos demais.
 */
export function markOutliers<T extends Pick<ReportListing, 'price' | 'excluded' | 'reason'>>(listings: T[]): T[] {
  const median = percentile(
    listings.filter((listing) => !listing.excluded).map((listing) => listing.price).sort((a, b) => a - b),
    0.5,
  );
  if (median === null) return listings;
  return listings.map((listing) =>
    !listing.excluded && listing.price < median * OUTLIER_SHARE ? { ...listing, excluded: 'auto', reason: 'cheap' } : listing,
  );
}

const round = (value: number) => Math.round(value * 100) / 100;

// O percentil p (0 a 1) com interpolação entre os dois vizinhos
const percentile = (sorted: number[], p: number) => {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return round(sorted[low] + (sorted[high] - sorted[low]) * (index - low));
};

export function statsOf(listings: ReportListing[]): ReportStats {
  const prices = listings
    .filter((listing) => !listing.excluded)
    .map((listing) => listing.price)
    .sort((a, b) => a - b);
  return {
    count: prices.length,
    average: prices.length ? round(prices.reduce((sum, price) => sum + price, 0) / prices.length) : null,
    median: percentile(prices, 0.5),
    min: prices[0] ?? null,
    max: prices[prices.length - 1] ?? null,
    p10: percentile(prices, 0.1),
    p25: percentile(prices, 0.25),
    p75: percentile(prices, 0.75),
    p90: percentile(prices, 0.9),
  };
}

/**
 * Fecha o relatório: as exclusões (as da regra, mais as que a pessoa escolheu por id; as que
 * ela repôs ficam a contar), as estatísticas e o valor do estado — ou o manual.
 */
export function finishReport(
  base: Omit<ValuationReport, 'stats' | 'condition' | 'chosenValue' | 'manual'>,
  choice: { condition: Condition | null; manualValue: number | null; excludedIds?: string[]; includedIds?: string[] },
): ValuationReport {
  const mark = (listing: ReportListing): ReportListing => {
    if (choice.excludedIds?.includes(listing.id)) return { ...listing, excluded: 'manual' };
    if (choice.includedIds?.includes(listing.id)) return { ...listing, excluded: null };
    return listing;
  };
  const forSale = base.forSale.map(mark);
  const sold = base.sold.map(mark);
  const stats = { forSale: statsOf(forSale), sold: statsOf(sold), all: statsOf([...forSale, ...sold]) };
  const condition = choice.condition ?? 'average';
  const fromStats = stats.all[CONDITION_STAT[condition]] as number | null;
  const manual = choice.manualValue !== null && choice.manualValue !== undefined;
  return {
    ...base,
    forSale,
    sold,
    stats,
    condition: manual ? choice.condition : condition,
    chosenValue: manual ? round(choice.manualValue!) : fromStats,
    manual,
  };
}
