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

export interface Personal_Portfolio {
  id: string;
  name: string;
  // manual · api (os de uma corretora, mais tarde)
  source: 'manual' | 'api';
  platform: { id: string; name: string; logo: string | null } | null;
  transactionCount: number;
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

export interface Portfolio_Summary {
  currency: { id: string; shortCode: string; symbol: string } | null;
  // Dias que foram pela cotação de referência por não haver a do dia
  estimatedRates: number;
  portfolios: { id: string; name: string }[];
  // Um ponto por dia com transações (e hoje): o saldo de cada portefólio e o total
  points: { date: string; values: Record<string, number>; total: number }[];
}

/** O valor de cada portefólio ao longo do tempo, na moeda escolhida no topo. */
export const usePortfolioSummary = (currencyId: string) => {
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
        params: currencyId ? { currencyId } : undefined,
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
  }, [currencyId, version]);

  return { data, error };
};
