import { useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';

export type Instrument_Type = 'spot' | 'perpetual' | 'future';

// O passo e os mínimos de cada ordem na corretora (texto, como a corretora os dá;
// a Coinbase vem com os mesmos nomes)
export interface Instrument_Metadata {
  stepSize?: string;
  minQty?: string;
  minNotional?: string;
  tickSize?: string;
}

export interface Market_Instrument {
  id: string;
  source: string;
  type: Instrument_Type;
  symbol: string;
  quote: string;
  status: string;
  expiresAt: string | null;
  metadata?: Instrument_Metadata | null;
  asset: { ticker: string | null; name: string };
}

export interface Instrument_Filters {
  search: string;
  source: string;
  type: Instrument_Type | '';
}

export interface Instrument_Facets {
  sources: { source: string; count: number }[];
  types: { type: Instrument_Type; count: number }[];
}

// "BTCUSDT" com quote "USDT" lê-se melhor como "BTC/USDT"
export const instrumentPair = (instrument: Market_Instrument) =>
  `${instrument.asset.ticker ?? instrument.symbol}/${instrument.quote}`;

// Nome da corretora como se escreve; as que não estão aqui mostram o id
const SOURCE_LABELS: Record<string, string> = { binance: 'Binance', coinbase: 'Coinbase' };

export const sourceLabel = (source: string) => SOURCE_LABELS[source] ?? source;

// Espera que se pare de escrever antes de ir ao servidor
const DEBOUNCE_MS = 250;
const PAGE = 20;

const filtersKey = (filters: Instrument_Filters) =>
  `${filters.search.trim()}|${filters.source}|${filters.type}`;

/**
 * Pesquisa de mercados para o input de ativos. Cada mudança de filtros começa
 * de novo na primeira página; "Ver mais" junta a seguinte à lista.
 *
 * O "a carregar" é derivado (a chave pedida ainda não é a carregada) em vez de
 * um setState dentro do efeito.
 */
export const useMarketInstruments = (filters: Instrument_Filters, enabled: boolean) => {
  const key = filtersKey(filters);
  const [result, setResult] = useState<{ key: string; items: Market_Instrument[]; total: number }>({
    key: '',
    items: [],
    total: 0,
  });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const timer = setTimeout(() => {
      http
        .get(End_Points.Market_Instruments_Endpoint(), {
          params: {
            search: filters.search.trim() || undefined,
            source: filters.source || undefined,
            type: filters.type || undefined,
            take: PAGE,
          },
        })
        .then((response) => {
          if (!cancelled) setResult({ key, ...response.data });
        })
        .catch(() => {
          if (!cancelled) setResult({ key, items: [], total: 0 });
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // A chave já resume os filtros
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  const loadMore = () => {
    setLoadingMore(true);
    http
      .get(End_Points.Market_Instruments_Endpoint(), {
        params: {
          search: filters.search.trim() || undefined,
          source: filters.source || undefined,
          type: filters.type || undefined,
          skip: result.items.length,
          take: PAGE,
        },
      })
      .then((response) => {
        setResult((prev) =>
          prev.key === key
            ? { key, items: [...prev.items, ...response.data.items], total: response.data.total }
            : prev,
        );
      })
      .finally(() => setLoadingMore(false));
  };

  const fresh = result.key === key;

  return {
    instruments: fresh ? result.items : [],
    total: fresh ? result.total : 0,
    loading: !fresh,
    loadingMore,
    loadMore,
  };
};

// Os valores dos filtros, uma vez por página
export const useInstrumentFacets = () => {
  const [facets, setFacets] = useState<Instrument_Facets>({ sources: [], types: [] });

  useEffect(() => {
    let cancelled = false;
    http
      .get(End_Points.Market_Instrument_Facets_Endpoint())
      .then((response) => {
        if (!cancelled) setFacets(response.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return facets;
};
