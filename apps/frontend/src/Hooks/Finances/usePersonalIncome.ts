import { useCallback, useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { getErrorMessage } from '../useAsyncRequest';

export const INCOME_SOURCE_KINDS = ['employer', 'client', 'lottery', 'other'] as const;
export type Income_Source_Kind = (typeof INCOME_SOURCE_KINDS)[number];
export const INCOME_KINDS = ['salary', 'freelance', 'lottery', 'other'] as const;
export type Income_Kind = (typeof INCOME_KINDS)[number];

export interface Income_Currency {
  id: string;
  shortCode: string;
  symbol: string;
  rate: number;
}

interface Company_Ref {
  id: string;
  name: string;
  slug: string;
}

export interface Income_Source {
  id: string;
  kind: Income_Source_Kind;
  name: string;
  companyId: string | null;
  company: Company_Ref | null;
  grossAmount: number | null;
  netAmount: number | null;
  currencyId: string | null;
  currency: Income_Currency | null;
  payDay: number | null;
  paymentsPerYear: number | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  isActive: boolean;
  _count: { incomes: number };
}

export interface Personal_Income {
  id: string;
  kind: Income_Kind;
  sourceId: string | null;
  source: { id: string; name: string; kind: Income_Source_Kind } | null;
  memberPayId: string | null;
  company: Company_Ref | null;
  period: string | null;
  description: string | null;
  grossAmount: number | null;
  amount: number;
  withholdingPct: number | null;
  currencyId: string;
  currency: Income_Currency;
  date: string;
  status: 'received' | 'pending';
  bankAccountId: string | null;
  bankAccount: { id: string; name: string } | null;
}

// Um salário que se espera e ainda não está registado (calculado no backend)
export interface Expected_Income {
  origin: 'source' | 'company';
  sourceId: string | null;
  memberPayId: string | null;
  period: string;
  part: 'salary' | 'holiday' | 'christmas' | 'freelance';
  kind: Income_Kind;
  date: string;
  overdue: boolean;
  name: string;
  company: Company_Ref | null;
  description: string | null;
  grossAmount: number | null;
  amount: number;
  withholdingPct: number | null;
  currency: Income_Currency;
  companyPaid: boolean;
}

export interface Income_Summary {
  currency: Income_Currency | null;
  // Os dias (de uma moeda) convertidos pela cotação de referência, por não haver a do dia
  estimatedRates: number;
  months: { month: string; received: number; pending: number; future: boolean }[];
  cards: {
    received: number;
    receivedYear: number;
    receivedThisMonth: number;
    monthlyAverage: number;
    pending: number;
    pendingCount: number;
    overdueCount: number;
  };
  byKind: { kind: Income_Kind; total: number }[];
  bySource: { key: string; name: string | null; kind: string; total: number; count: number }[];
  upcoming: {
    id: string | null;
    origin: 'record' | 'source' | 'company';
    name: string | null;
    kind: Income_Kind;
    part: Expected_Income['part'] | null;
    period: string | null;
    date: string;
    overdue: boolean;
    amount: number;
    currency: Income_Currency;
    companyPaid: boolean;
  }[];
}

export interface Personal_Bank_Account {
  id: string;
  name: string;
  currencyId: string;
  status: string;
}

export interface Income_Filters {
  from: string;
  to: string;
  kind: string;
  sourceId: string;
  status: string;
}

/**
 * O dashboard dos ganhos, contado no backend na moeda pedida. Com `range` (meses
 * `YYYY-MM`), o gráfico e as somas por tipo e por fonte são desse intervalo.
 */
export const useIncomeSummary = (
  months: number,
  future: number,
  currencyId: string | undefined,
  range: { from: string; to: string } | null = null,
) => {
  const [data, setData] = useState<Income_Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const from = range?.from;
  const to = range?.to;

  useEffect(() => {
    let cancelled = false;
    http
      .get<Income_Summary>(End_Points.Personal_Income_Summary_Endpoint(), {
        params: { months, future, currencyId: currencyId || undefined, from, to },
      })
      .then((response) => {
        if (cancelled) return;
        setData(response.data);
        setError(null);
      })
      .catch((reason) => {
        if (!cancelled) setError(getErrorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [months, future, currencyId, from, to]);

  return { data, error };
};

/**
 * O registo dos ganhos: os registados (com os filtros), os esperados por
 * receber, as fontes, as empresas a que uma fonte se liga e as contas pessoais,
 * com o gravar e o apagar. Depois de gravar, volta a pedir tudo.
 */
export const useIncomeRegister = (filters: Income_Filters, expectedMonths: number) => {
  const [incomes, setIncomes] = useState<Personal_Income[] | null>(null);
  const [expected, setExpected] = useState<Expected_Income[] | null>(null);
  const [sources, setSources] = useState<Income_Source[]>([]);
  const [companies, setCompanies] = useState<Company_Ref[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Personal_Bank_Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);
  const { from, to, kind, sourceId, status } = filters;

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      http.get<Personal_Income[]>(End_Points.Personal_Incomes_Endpoint(), {
        params: {
          from: from || undefined,
          to: to || undefined,
          kind: kind || undefined,
          sourceId: sourceId || undefined,
          status: status || undefined,
        },
      }),
      http.get<Expected_Income[]>(End_Points.Personal_Expected_Incomes_Endpoint(), {
        params: { months: expectedMonths },
      }),
      http.get<Income_Source[]>(End_Points.Personal_Income_Sources_Endpoint()),
    ])
      .then(([incomesResponse, expectedResponse, sourcesResponse]) => {
        if (cancelled) return;
        setIncomes(incomesResponse.data);
        setExpected(expectedResponse.data);
        setSources(sourcesResponse.data);
        setError(null);
      })
      .catch((reason) => {
        if (!cancelled) setError(getErrorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, kind, sourceId, status, expectedMonths, version]);

  // As empresas e as contas mudam pouco: uma vez
  useEffect(() => {
    http
      .get<Company_Ref[]>(End_Points.Personal_Income_Companies_Endpoint())
      .then((response) => setCompanies(response.data))
      .catch(() => setCompanies([]));
    http
      .get<Personal_Bank_Account[]>(End_Points.Bank_Account_Endpoint())
      .then((response) => setBankAccounts(response.data))
      .catch(() => setBankAccounts([]));
  }, []);

  // Corre o pedido; true se correu bem (o erro fica em `actionError`)
  const [actionError, setActionError] = useState<string | null>(null);
  const act = async (request: () => Promise<unknown>) => {
    setSaving(true);
    setActionError(null);
    try {
      await request();
      reload();
      return true;
    } catch (reason) {
      setActionError(getErrorMessage(reason));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    incomes,
    expected,
    sources,
    companies,
    bankAccounts,
    error,
    saving,
    actionError,
    clearActionError: () => setActionError(null),
    reload,
    saveSource: (id: string | null, body: Record<string, unknown>) =>
      act(() =>
        id
          ? http.patch(End_Points.Personal_Income_Source_Endpoint(id), body)
          : http.post(End_Points.Personal_Income_Sources_Endpoint(), body),
      ),
    deleteSource: (id: string) => act(() => http.delete(End_Points.Personal_Income_Source_Endpoint(id))),
    saveIncome: (id: string | null, body: Record<string, unknown>) =>
      act(() =>
        id
          ? http.patch(End_Points.Personal_Income_Endpoint(id), body)
          : http.post(End_Points.Personal_Incomes_Endpoint(), body),
      ),
    deleteIncome: (id: string) => act(() => http.delete(End_Points.Personal_Income_Endpoint(id))),
  };
};
