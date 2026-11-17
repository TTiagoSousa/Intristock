import { useCallback, useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { getErrorMessage } from '../useAsyncRequest';
import type { Personal_Bank_Account } from './usePersonalIncome';

// Os tipos de ativo que se escolhem ao adicionar uma transação; para já só o dinheiro passivo
export const PORTFOLIO_ASSET_TYPES = ['securities', 'crypto', 'cash', 'metals', 'property', 'other'] as const;
export type Portfolio_Asset_Type = (typeof PORTFOLIO_ASSET_TYPES)[number];
export const AVAILABLE_ASSET_TYPES: Portfolio_Asset_Type[] = ['cash'];

export const CASH_TRANSACTION_KINDS = ['deposit', 'withdrawal', 'interest', 'fee', 'tax'] as const;
export type Cash_Transaction_Kind = (typeof CASH_TRANSACTION_KINDS)[number];

export type Portfolio_Platform = { id: string; name: string; logo: string | null };

export interface Personal_Portfolio {
  id: string;
  name: string;
  // manual · api (os de uma corretora: só de leitura, mantém-nos a ligação)
  source: 'manual' | 'api';
  platform: Portfolio_Platform | null;
  connectionId?: string | null;
  syncedAt?: string | null;
  transactionCount: number;
}

type Portfolio_Currency = { id: string; name: string; shortCode: string; symbol: string };

/** Uma transação de um portefólio (o valor sempre positivo: o tipo diz o lado). */
export interface Portfolio_Transaction {
  id: string;
  portfolioId: string;
  kind: string;
  date: string;
  quantity: number | string;
  amount: number | string;
  currency: Portfolio_Currency;
  asset: { id: string; name: string; assetClass: string; subClass: string };
  bankAccount: { id: string; name: string } | null;
  notes: string | null;
  // Nas ações: o mercado onde foi (o ticker da corretora) e o de onde vem o preço
  instrument: {
    id: string;
    symbol: string;
    quote: string;
    priceInstrument: { id: string; symbol: string; quote: string } | null;
  } | null;
  // Os que vêm de uma corretora: o tipo dela e o instante exato
  externalType: string | null;
  externalAt: string | null;
  portfolio?: { id: string; name: string; source: 'manual' | 'api'; platform: Portfolio_Platform | null };
}

// O que cada tipo faz ao dinheiro (o dinheiro de uma compra de ações sai noutra linha,
// `transfer_out`, no portefólio do dinheiro)
export const KIND_SIGN: Record<string, number> = {
  deposit: 1,
  interest: 1,
  dividend: 1,
  transfer_in: 1,
  withdrawal: -1,
  fee: -1,
  tax: -1,
  transfer_out: -1,
};

// Os tipos que mexem na quantidade de um ativo (não no dinheiro)
export const POSITION_KINDS = ['buy', 'sell', 'adjust'];

// Os tipos do filtro das transações, por esta ordem
export const TRANSACTION_KINDS = [...Object.keys(KIND_SIGN), ...POSITION_KINDS];

/** Uma posição de um portefólio (uma ação), com o último fecho do mercado dela. */
export interface Portfolio_Position {
  asset: { id: string; name: string; assetClass: string; subClass: string };
  symbol: string | null;
  priceSymbol: string | null;
  quantity: number;
  // Na moeda das compras
  cost: number;
  averageCost: number | null;
  realized: number;
  currency: Portfolio_Currency;
  price: { close: number; date: string; quote: string; currency: Portfolio_Currency } | null;
  // Na moeda do preço
  value: number | null;
}

/** Uma ligação a uma corretora (sem a chave, que nunca volta ao browser). */
export interface Broker_Connection {
  id: string;
  externalAccountId: string;
  currencyCode: string | null;
  fromDate: string | null;
  // active · error · paused
  status: 'active' | 'error' | 'paused';
  lastError: string | null;
  syncedAt: string | null;
  syncing: boolean;
  platform: Portfolio_Platform;
  portfolios: { id: string; name: string; externalId: string | null }[];
}

export interface Cash_Transaction_Body {
  kind: Cash_Transaction_Kind;
  date: string;
  amount: number;
  currencyId: string;
  bankAccountId: string | null;
  notes: string | null;
}

/** Os portefólios da pessoa e as contas dela, para o popover de adicionar uma transação. */
export const usePortfolioTransaction = () => {
  const [portfolios, setPortfolios] = useState<Personal_Portfolio[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Personal_Bank_Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      http.get<Personal_Portfolio[]>(End_Points.Personal_Portfolios_Endpoint()),
      http.get<Personal_Bank_Account[]>(End_Points.Bank_Account_Endpoint()),
    ])
      .then(([portfolioResponse, accountResponse]) => {
        if (cancelled) return;
        setPortfolios(portfolioResponse.data);
        setBankAccounts(accountResponse.data);
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const createPortfolio = useCallback(async (name: string) => {
    setSaving(true);
    setError(null);
    try {
      const { data } = await http.post<Personal_Portfolio>(End_Points.Personal_Portfolios_Endpoint(), { name });
      setPortfolios((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
      return data;
    } catch (err) {
      setError(getErrorMessage(err));
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const createCashTransaction = useCallback(async (portfolioId: string, body: Cash_Transaction_Body) => {
    setSaving(true);
    setError(null);
    try {
      await http.post(End_Points.Personal_Portfolio_Cash_Endpoint(portfolioId), body);
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { portfolios, bankAccounts, loading, saving, error, setError, createPortfolio, createCashTransaction };
};

// O popover avisa com isto depois de gravar, para o resumo voltar a pedir os números
export const PORTFOLIO_CHANGED_EVENT = 'portfolio:changed';

// Os períodos do gráfico do resumo: desde a primeira transação ou para trás de hoje
export const SUMMARY_RANGES = ['all', '5y', '2y', '1y', '6m', '3m', '1m', '7d', '24h'] as const;
export type Summary_Range = (typeof SUMMARY_RANGES)[number];

export interface Portfolio_Summary {
  currency: { id: string; shortCode: string; symbol: string } | null;
  range: Summary_Range;
  // day: um ponto por dia (date = YYYY-MM-DD); hour: por hora (date em ISO)
  granularity: 'day' | 'hour';
  // Dias que foram pela cotação de referência por não haver a do dia
  estimatedRates: number;
  portfolios: { id: string; name: string; source: 'manual' | 'api'; platform: Portfolio_Platform | null }[];
  // Um ponto por dia com transações (e hoje): o saldo de cada portefólio e o total
  // Em cada ponto, também a rentabilidade desde o início do período (em %; nula quando não dá)
  points: ({ date: string; values: Record<string, number>; total: number } & Portfolio_Return)[];
  // O resultado do período (o último ponto) e a TIR anual
  returns: (Portfolio_Return & { xirrPct: number | null; days: number }) | null;
}

/**
 * A rentabilidade: o que se meteu (o valor de partida mais os depósitos menos os
 * levantamentos), o ganho em dinheiro e as três percentagens.
 */
export interface Portfolio_Return {
  invested: number;
  gain: number;
  // O ganho sobre o investido
  simplePct: number | null;
  // Ponderada no tempo (TWR)
  twrPct: number | null;
  // Ponderada pelo dinheiro (TIR do período, sem anualizar)
  mwrPct: number | null;
}

// O que o gráfico do resumo mostra: o valor em dinheiro ou uma das rentabilidades
export const SUMMARY_MODES = ['value', 'gain', 'twr', 'mwr'] as const;
export type Summary_Mode = (typeof SUMMARY_MODES)[number];

/** O valor de cada portefólio ao longo do tempo, na moeda escolhida no topo. */
export const usePortfolioSummary = (currencyId: string, range: Summary_Range = 'all') => {
  const [data, setData] = useState<Portfolio_Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1);
    window.addEventListener(PORTFOLIO_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PORTFOLIO_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    http
      .get<Portfolio_Summary>(End_Points.Personal_Portfolio_Summary_Endpoint(), {
        params: { ...(currencyId ? { currencyId } : {}), range },
      })
      .then(({ data: summary }) => {
        if (cancelled) return;
        setData(summary);
        setError(null);
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [currencyId, range, version]);

  return { data, error };
};

// As categorias gerais da distribuição (as mesmas do servidor)
export const ALLOCATION_CATEGORIES = ['cash', 'securities', 'crypto', 'property', 'goods', 'other'] as const;
export type Allocation_Category = (typeof ALLOCATION_CATEGORIES)[number];

/** O que se tem hoje, na moeda pedida: por categoria geral e, dentro dela, por ativo (do maior). */
export interface Portfolio_Allocation_Data {
  currency: { id: string; shortCode: string; symbol: string } | null;
  total: number;
  estimatedRates: number;
  categories: {
    key: Allocation_Category;
    value: number;
    assets: { id: string; name: string; ticker: string | null; value: number }[];
  }[];
}

/** A distribuição de hoje, na moeda do topo; volta a pedir depois de gravar uma transação. */
export const usePortfolioAllocation = (currencyId: string) => {
  const [data, setData] = useState<Portfolio_Allocation_Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1);
    window.addEventListener(PORTFOLIO_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PORTFOLIO_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    http
      .get<Portfolio_Allocation_Data>(End_Points.Personal_Portfolio_Allocation_Endpoint(), {
        params: currencyId ? { currencyId } : undefined,
      })
      .then(({ data: allocation }) => {
        if (cancelled) return;
        setData(allocation);
        setError(null);
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [currencyId, version]);

  return { data, error };
};

export interface Portfolio_Transaction_Filters {
  from: string;
  to: string;
  source: '' | 'manual' | 'api';
  platformId: string;
  portfolioId: string;
  assetId: string;
  kind: string;
}

export const EMPTY_TRANSACTION_FILTERS: Portfolio_Transaction_Filters = {
  from: '',
  to: '',
  source: '',
  platformId: '',
  portfolioId: '',
  assetId: '',
  kind: '',
};

/** Uma página das transações: quantas são ao todo e o saldo de todas (na moeda pedida). */
export interface Portfolio_Transaction_Page {
  transactions: Portfolio_Transaction[];
  total: number;
  page: number;
  take: number;
  net: number;
  currency: { id: string; shortCode: string; symbol: string } | null;
  estimatedRates: number;
  assets: { id: string; name: string; subClass: string; ticker: string | null }[];
}

/**
 * Todas as transações da pessoa com os filtros, uma página de cada vez (o servidor
 * conta-as e soma o saldo de todas), e os portefólios e os ativos para os filtros.
 */
export const usePortfolioTransactions = (
  filters: Portfolio_Transaction_Filters,
  page: number,
  take: number,
  currencyId: string,
) => {
  const [data, setData] = useState<Portfolio_Transaction_Page | null>(null);
  const [assets, setAssets] = useState<Portfolio_Transaction_Page['assets']>([]);
  const [portfolios, setPortfolios] = useState<Personal_Portfolio[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    http
      .get<Personal_Portfolio[]>(End_Points.Personal_Portfolios_Endpoint())
      .then(({ data }) => !cancelled && setPortfolios(data))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = {
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
      ...(currencyId ? { currencyId } : {}),
      page,
      take,
    };
    http
      .get<Portfolio_Transaction_Page>(End_Points.Personal_Portfolio_All_Transactions_Endpoint(), { params })
      .then(({ data: result }) => {
        if (cancelled) return;
        setData(result);
        setAssets(result.assets);
        setError(null);
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [filters, page, take, currencyId]);

  return { data, assets, portfolios, error };
};

/** Um portefólio e as transações dele (num de uma corretora, só desde o dia escolhido na ligação). */
export const usePortfolioDetail = (portfolioId: string) => {
  const [portfolio, setPortfolio] = useState<Personal_Portfolio | null>(null);
  const [transactions, setTransactions] = useState<Portfolio_Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1);
    window.addEventListener(PORTFOLIO_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PORTFOLIO_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      http.get<Personal_Portfolio>(End_Points.Personal_Portfolio_Endpoint(portfolioId)),
      http.get<Portfolio_Transaction[]>(End_Points.Personal_Portfolio_Transactions_Endpoint(portfolioId)),
    ])
      .then(([portfolioResponse, transactionResponse]) => {
        if (cancelled) return;
        setPortfolio(portfolioResponse.data);
        setTransactions(transactionResponse.data);
        setError(null);
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [portfolioId, version]);

  return { portfolio, transactions, error };
};

/** As posições (ações) de um portefólio. */
export const usePortfolioPositions = (portfolioId: string) => {
  const [positions, setPositions] = useState<Portfolio_Position[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    http
      .get<Portfolio_Position[]>(End_Points.Personal_Portfolio_Positions_Endpoint(portfolioId))
      .then(({ data }) => !cancelled && setPositions(data))
      .catch(() => !cancelled && setPositions([]));
    return () => {
      cancelled = true;
    };
  }, [portfolioId]);
  return positions;
};

export interface Broker_Connection_Body {
  apiKey?: string;
  apiSecret?: string;
  fromDate?: string | null;
  paused?: boolean;
}

/**
 * As ligações às corretoras: ligar, mudar, sincronizar e apagar. Enquanto alguma
 * está a sincronizar (a primeira traz o histórico todo), volta a pedir de 5 em 5 s.
 */
export const useBrokerConnections = () => {
  const [connections, setConnections] = useState<Broker_Connection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    http
      .get<Broker_Connection[]>(End_Points.Broker_Connections_Endpoint())
      .then(({ data }) => {
        if (cancelled) return;
        setConnections(data);
        setError(null);
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [version]);

  const syncing = connections?.some((connection) => connection.syncing) ?? false;
  useEffect(() => {
    if (!syncing) return;
    const timer = window.setTimeout(() => {
      reload();
      window.dispatchEvent(new Event(PORTFOLIO_CHANGED_EVENT));
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [syncing, connections, reload]);

  // Corre uma ação e põe a ligação que ela devolve no lugar da antiga
  const run = useCallback(async (key: string, action: () => Promise<Broker_Connection | null>) => {
    setBusy(key);
    setActionError(null);
    try {
      const updated = await action();
      if (updated)
        setConnections((current) => {
          const list = current ?? [];
          return list.some((item) => item.id === updated.id)
            ? list.map((item) => (item.id === updated.id ? updated : item))
            : [...list, updated];
        });
      window.dispatchEvent(new Event(PORTFOLIO_CHANGED_EVENT));
      return true;
    } catch (err) {
      setActionError(getErrorMessage(err));
      return false;
    } finally {
      setBusy(null);
    }
  }, []);

  const connect = (body: Broker_Connection_Body) =>
    run('connect', async () => (await http.post<Broker_Connection>(End_Points.Broker_Connections_Endpoint(), body)).data);

  const update = (id: string, body: Broker_Connection_Body) =>
    run(id, async () => (await http.patch<Broker_Connection>(End_Points.Broker_Connection_Endpoint(id), body)).data);

  const sync = (id: string) =>
    run(id, async () => (await http.post<Broker_Connection>(End_Points.Broker_Connection_Sync_Endpoint(id))).data);

  const remove = async (id: string) => {
    const done = await run(id, async () => {
      await http.delete(End_Points.Broker_Connection_Endpoint(id));
      return null;
    });
    if (done) setConnections((current) => (current ?? []).filter((item) => item.id !== id));
    return done;
  };

  return { connections, error, actionError, setActionError, busy, connect, update, sync, remove };
};
