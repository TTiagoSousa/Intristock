import { useCallback, useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { getErrorMessage } from '../useAsyncRequest';
import type { Portfolio_Currency } from './usePersonalPortfolio';

// O estado do bem → o ponto dos preços que se usa (para restaurar = os 10 % mais baratos)
export const GOODS_CONDITIONS = ['restore', 'below', 'average', 'above', 'mint'] as const;
export type Goods_Condition = (typeof GOODS_CONDITIONS)[number];
export const CONDITION_STAT: Record<Goods_Condition, keyof Report_Stats> = {
  restore: 'p10',
  below: 'p25',
  average: 'median',
  above: 'p75',
  mint: 'p90',
};
export const ACQUISITIONS = ['purchase', 'gift', 'inheritance', 'other'] as const;
export type Goods_Acquisition = (typeof ACQUISITIONS)[number];
export const GOODS_CASH_MODES = ['new', 'portfolio', 'none'] as const;
export type Goods_Cash_Mode = (typeof GOODS_CASH_MODES)[number];
// De quantos em quantos dias o valor se atualiza sozinho (0 = só à mão)
export const VALUATION_INTERVALS = [0, 7, 30, 90] as const;
export const DEFAULT_LOCATION = 'Lisbon, Portugal';
export const DEFAULT_RADIUS_KM = 200;

export interface Report_Listing {
  id: string;
  title: string;
  price: number;
  location: string | null;
  link: string | null;
  listedAt: string | null;
  thumbnail: string | null;
  // Não conta: `auto` (a regra: barato, peças, outro modelo) ou `manual` (tirado à mão)
  excluded: 'auto' | 'manual' | null;
  reason: string | null;
}

export interface Report_Stats {
  count: number;
  average: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  p10: number | null;
  p25: number | null;
  p75: number | null;
  p90: number | null;
}

/** O relatório de uma pesquisa de preços (o que fica gravado na avaliação). */
export interface Valuation_Report {
  source: 'facebook_marketplace';
  query: string;
  location: string;
  radiusKm: number;
  currency: string;
  fetchedAt: string;
  forSale: Report_Listing[];
  sold: Report_Listing[];
  stats: { forSale: Report_Stats; sold: Report_Stats; all: Report_Stats };
  condition: Goods_Condition | null;
  chosenValue: number | null;
  manual: boolean;
}

export interface Goods_Details {
  vehicleType: 'motorcycle';
  brand: string;
  model: string;
  version?: string;
  year?: number;
  plate?: string;
  searchQuery?: string;
  location?: string;
  radiusKm?: number;
}

/** Um valor: à mão, ou o relatório com as escolhas da pessoa. */
export interface Goods_Valuation_Body {
  report?: Valuation_Report;
  condition?: Goods_Condition;
  manualValue?: number | null;
  excludedIds?: string[];
  includedIds?: string[];
}

export interface Create_Goods_Body {
  portfolioId: string;
  details: Goods_Details;
  name?: string;
  date: string;
  acquisition: Goods_Acquisition;
  price?: number | null;
  currencyId: string;
  cash: Goods_Cash_Mode;
  cashPortfolioId?: string;
  valuation?: Goods_Valuation_Body;
  valuationEveryDays?: number | null;
  notes?: string;
}

export interface Goods_View {
  asset: {
    id: string;
    name: string;
    details: Goods_Details;
    valuationEveryDays: number | null;
    valuationNextAt: string | null;
  };
  portfolio: { id: string; name: string } | null;
  currency: Portfolio_Currency | null;
  held: boolean;
  acquisition: Goods_Acquisition | null;
  acquiredAt: string | null;
  purchasePrice: number | null;
  entryValue: number | null;
  value: number;
  sale: { date: string; price: number; realized: number } | null;
  history: { id: string; kind: 'buy' | 'valuation'; date: string; value: number; source: 'entry' | 'manual' | 'search'; condition: Goods_Condition | null; notes: string | null }[];
  report: Valuation_Report | null;
}

// Quantos anúncios contam (sem os tirados)
const counted = (listings: Report_Listing[]) => listings.filter((row) => !row.excluded).map((row) => row.price).sort((a, b) => a - b);
const percentile = (sorted: number[], p: number) => {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return Math.round((sorted[low] + (sorted[high] - sorted[low]) * (index - low)) * 100) / 100;
};

/** As estatísticas dos anúncios que contam — as mesmas contas do servidor, para o ecrã acompanhar as escolhas. */
export const statsOf = (listings: Report_Listing[]): Report_Stats => {
  const prices = counted(listings);
  return {
    count: prices.length,
    average: prices.length ? Math.round((prices.reduce((sum, price) => sum + price, 0) / prices.length) * 100) / 100 : null,
    median: percentile(prices, 0.5),
    min: prices[0] ?? null,
    max: prices[prices.length - 1] ?? null,
    p10: percentile(prices, 0.1),
    p25: percentile(prices, 0.25),
    p75: percentile(prices, 0.75),
    p90: percentile(prices, 0.9),
  };
};

/** Tirar ou repor um anúncio: devolve o relatório com as estatísticas refeitas. */
export const toggleListing = (report: Valuation_Report, id: string): Valuation_Report => {
  const flip = (row: Report_Listing): Report_Listing =>
    row.id !== id ? row : { ...row, excluded: row.excluded ? null : 'manual' };
  const forSale = report.forSale.map(flip);
  const sold = report.sold.map(flip);
  return { ...report, forSale, sold, stats: { forSale: statsOf(forSale), sold: statsOf(sold), all: statsOf([...forSale, ...sold]) } };
};

/** O que vai para o servidor: o relatório e os que se tiraram e repuseram à mão. */
export const valuationBody = (report: Valuation_Report, condition: Goods_Condition, manualValue: number | null): Goods_Valuation_Body => {
  const all = [...report.forSale, ...report.sold];
  return {
    report,
    condition,
    manualValue,
    excludedIds: all.filter((row) => row.excluded === 'manual').map((row) => row.id),
    includedIds: all.filter((row) => !row.excluded && row.reason).map((row) => row.id),
  };
};

/** A pesquisa de preços (gasta 2 pesquisas da SerpApi). */
export const searchGoodsPrices = async (query: string, location: string, radiusKm: number) =>
  (await http.post<Valuation_Report>(End_Points.Personal_Goods_Prices_Endpoint(), { query, location, radiusKm })).data;

/** As localidades para a pesquisa (não gasta pesquisas). */
export const searchGoodsLocations = async (q: string) =>
  (await http.get<{ name: string }[]>(End_Points.Personal_Goods_Locations_Endpoint(), { params: { q } })).data;

/** Se há chaves da SerpApi com pesquisas (sem elas, o pesquisar não aparece). */
export const usePricesAvailable = () => {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    http
      .get<{ available: boolean }>(End_Points.Personal_Goods_Prices_Available_Endpoint())
      .then(({ data }) => !cancelled && setAvailable(data.available))
      .catch(() => !cancelled && setAvailable(false));
    return () => {
      cancelled = true;
    };
  }, []);
  return available;
};

export const createGoods = async (body: Create_Goods_Body) =>
  (await http.post<{ assetId: string }>(End_Points.Personal_Goods_Endpoint(), body)).data;

/** Um bem: ver, mudar, avaliar e vender. */
export const useGoods = (assetId: string) => {
  const [goods, setGoods] = useState<Goods_View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    http
      .get<Goods_View>(End_Points.Personal_Goods_Item_Endpoint(assetId))
      .then(({ data }) => !cancelled && setGoods(data))
      .catch((err) => !cancelled && setError(getErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  const run = useCallback(async (request: () => Promise<{ data: Goods_View }>) => {
    setSaving(true);
    setError(null);
    try {
      const { data } = await request();
      setGoods(data);
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const update = (body: { name?: string; details?: Goods_Details; valuationEveryDays?: number | null }) =>
    run(() => http.patch<Goods_View>(End_Points.Personal_Goods_Item_Endpoint(assetId), body));
  const addValuation = (body: Goods_Valuation_Body & { date?: string; notes?: string }) =>
    run(() => http.post<Goods_View>(End_Points.Personal_Goods_Valuations_Endpoint(assetId), body));
  const sell = (body: { date: string; price: number; cash: Goods_Cash_Mode; cashPortfolioId?: string; notes?: string }) =>
    run(() => http.post<Goods_View>(End_Points.Personal_Goods_Sell_Endpoint(assetId), body));

  return { goods, error, setError, saving, update, addValuation, sell };
};
