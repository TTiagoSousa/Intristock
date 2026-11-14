import { useCallback, useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { getErrorMessage } from '../useAsyncRequest';
import type { Income_Currency, Personal_Bank_Account } from './usePersonalIncome';

export const EXPENSE_KINDS = ['purchase', 'company', 'other'] as const;
// As de uma subscrição gravam-se ao marcar um pagamento como pago; só no filtro
export const EXPENSE_FILTER_KINDS = [...EXPENSE_KINDS, 'subscription'] as const;
export type Expense_Kind = (typeof EXPENSE_FILTER_KINDS)[number];

export const SUBSCRIPTION_KINDS = ['video', 'music', 'gaming', 'software', 'news', 'other'] as const;
export type Subscription_Kind = (typeof SUBSCRIPTION_KINDS)[number];
export const SUBSCRIPTION_STATUSES = ['active', 'paused', 'cancelled'] as const;
export type Subscription_Status = (typeof SUBSCRIPTION_STATUSES)[number];

export interface Expense_Category {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
}

export interface Personal_Product {
  id: string;
  name: string;
  brand: string | null;
  unit: string | null;
  categoryId: string | null;
  // Nas despesas pagas, na moeda pedida
  count: number;
  quantity: number;
  total: number;
  lastPrice: number | null;
  lastDate: string | null;
}

export interface Item_Category_Total {
  id: string | null;
  name: string | null;
  total: number;
  children: Item_Category_Total[];
}

interface Category_Ref {
  id: string;
  name: string;
  parentId: string | null;
}

export interface Expense_Item {
  id: string;
  productId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Personal_Expense {
  id: string;
  kind: Expense_Kind;
  date: string;
  merchant: string | null;
  description: string | null;
  categoryId: string | null;
  category: Category_Ref | null;
  companyId: string | null;
  company: { id: string; name: string; slug: string } | null;
  companyPaymentId: string | null;
  amount: number;
  currencyId: string;
  currency: Income_Currency;
  status: 'paid' | 'pending';
  bankAccountId: string | null;
  bankAccount: { id: string; name: string } | null;
  notes: string | null;
  subscriptionId: string | null;
  period: string | null;
  items: Expense_Item[];
}

export interface Personal_Subscription {
  id: string;
  kind: Subscription_Kind;
  name: string;
  merchant: string | null;
  amount: number;
  currencyId: string;
  currency: Income_Currency;
  recurring: boolean;
  intervalMonths: number;
  billingDay: number | null;
  startDate: string;
  endDate: string | null;
  status: Subscription_Status;
  categoryId: string | null;
  bankAccountId: string | null;
  notes: string | null;
  // Na moeda da subscrição: o que custa por mês (nulo numa não recorrente)
  monthlyAmount: number | null;
  nextDate: string | null;
  lastPaidDate: string | null;
  paidCount: number;
  paidTotal: number;
}

// Um pagamento de uma subscrição: pago (com a despesa) ou por pagar
export interface Subscription_Period {
  subscriptionId: string;
  period: string;
  date: string;
  amount: number;
  paid: boolean;
  expenseId: string | null;
  overdue: boolean;
}

export interface Subscriptions_Data {
  currency: Income_Currency | null;
  subscriptions: Personal_Subscription[];
  periods: Subscription_Period[];
  // Na moeda pedida: as ativas recorrentes por mês e por ano
  totals: { monthly: number; yearly: number; active: number; overdue: number };
}

export interface Expense_Summary {
  currency: Income_Currency | null;
  // Os dias (de uma moeda) convertidos pela cotação de referência, por não haver a do dia
  estimatedRates: number;
  months: { month: string; paid: number; pending: number }[];
  cards: { total: number; thisMonth: number; lastMonth: number; year: number; monthlyAverage: number; pending: number };
  // Cada despesa soma na categoria dela e em todas as de cima
  byCategory: Item_Category_Total[];
  byItem: Item_Category_Total[];
  byKind: { kind: Expense_Kind; total: number }[];
  merchants: { name: string; total: number; count: number }[];
  products: { id: string; name: string; total: number; quantity: number; count: number; lastPrice: number; lastDate: string }[];
}

export interface Expense_Filters {
  from: string;
  to: string;
  kind: string;
  categoryId: string;
  q: string;
}

/** O dashboard das despesas, contado no backend na moeda pedida. */
// Com `range` (meses `YYYY-MM`), o gráfico e as somas são desse intervalo; os cartões não mudam
export const useExpenseSummary = (
  months: number,
  currencyId: string | undefined,
  range: { from: string; to: string } | null = null,
) => {
  const [data, setData] = useState<Expense_Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const from = range?.from;
  const to = range?.to;

  useEffect(() => {
    let cancelled = false;
    http
      .get<Expense_Summary>(End_Points.Personal_Expense_Summary_Endpoint(), {
        params: { months, currencyId: currencyId || undefined, from, to },
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
  }, [months, currencyId, from, to]);

  return { data, error };
};

/**
 * O registo das despesas: as despesas (com os filtros), as categorias, os
 * produtos, as contas pessoais e as empresas, com o gravar e o apagar.
 */
export const useExpenseRegister = (filters: Expense_Filters) => {
  const [expenses, setExpenses] = useState<Personal_Expense[] | null>(null);
  const [categories, setCategories] = useState<Expense_Category[]>([]);
  const [itemCategories, setItemCategories] = useState<Expense_Category[]>([]);
  const [products, setProducts] = useState<Personal_Product[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Personal_Bank_Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);
  const { from, to, kind, categoryId, q } = filters;

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      http.get<Personal_Expense[]>(End_Points.Personal_Expenses_Endpoint(), {
        params: {
          from: from || undefined,
          to: to || undefined,
          kind: kind || undefined,
          categoryId: categoryId || undefined,
          q: q.trim() || undefined,
        },
      }),
      http.get<Expense_Category[]>(End_Points.Personal_Expense_Categories_Endpoint()),
      http.get<Expense_Category[]>(End_Points.Personal_Item_Categories_Endpoint()),
      http.get<{ products: Personal_Product[] }>(End_Points.Personal_Products_Endpoint()),
    ])
      .then(([expensesResponse, categoriesResponse, itemCategoriesResponse, productsResponse]) => {
        if (cancelled) return;
        setExpenses(expensesResponse.data);
        setCategories(categoriesResponse.data);
        setItemCategories(itemCategoriesResponse.data);
        setProducts(productsResponse.data.products);
        setError(null);
      })
      .catch((reason) => {
        if (!cancelled) setError(getErrorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, kind, categoryId, q, version]);

  useEffect(() => {
    http
      .get<{ id: string; name: string }[]>(End_Points.Personal_Income_Companies_Endpoint())
      .then((response) => setCompanies(response.data))
      .catch(() => setCompanies([]));
    http
      .get<Personal_Bank_Account[]>(End_Points.Bank_Account_Endpoint())
      .then((response) => setBankAccounts(response.data))
      .catch(() => setBankAccounts([]));
  }, []);

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
    expenses,
    categories,
    itemCategories,
    products,
    companies,
    bankAccounts,
    error,
    saving,
    actionError,
    clearActionError: () => setActionError(null),
    saveExpense: (id: string | null, body: Record<string, unknown>) =>
      act(() =>
        id
          ? http.patch(End_Points.Personal_Expense_Endpoint(id), body)
          : http.post(End_Points.Personal_Expenses_Endpoint(), body),
      ),
    deleteExpense: (id: string) => act(() => http.delete(End_Points.Personal_Expense_Endpoint(id))),
    saveCategory: (id: string | null, body: Record<string, unknown>) =>
      act(() =>
        id
          ? http.patch(End_Points.Personal_Expense_Category_Endpoint(id), body)
          : http.post(End_Points.Personal_Expense_Categories_Endpoint(), body),
      ),
  };
};

/**
 * A página Itens: o catálogo (com o que se gastou em cada um, na moeda pedida),
 * as categorias dos itens em árvore e as das despesas, com o gravar.
 */
export const useExpenseItems = (currencyId: string | undefined) => {
  const [products, setProducts] = useState<Personal_Product[] | null>(null);
  const [currency, setCurrency] = useState<Income_Currency | null>(null);
  const [itemCategories, setItemCategories] = useState<Expense_Category[]>([]);
  const [categories, setCategories] = useState<Expense_Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      http.get<{ currency: Income_Currency | null; products: Personal_Product[] }>(End_Points.Personal_Products_Endpoint(), {
        params: { currencyId: currencyId || undefined },
      }),
      http.get<Expense_Category[]>(End_Points.Personal_Item_Categories_Endpoint()),
      http.get<Expense_Category[]>(End_Points.Personal_Expense_Categories_Endpoint()),
    ])
      .then(([productsResponse, itemCategoriesResponse, categoriesResponse]) => {
        if (cancelled) return;
        setProducts(productsResponse.data.products);
        setCurrency(productsResponse.data.currency);
        setItemCategories(itemCategoriesResponse.data);
        setCategories(categoriesResponse.data);
        setError(null);
      })
      .catch((reason) => {
        if (!cancelled) setError(getErrorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [currencyId, version]);

  const act = async (request: () => Promise<unknown>) => {
    setSaving(true);
    setActionError(null);
    try {
      await request();
      setVersion((current) => current + 1);
      return true;
    } catch (reason) {
      setActionError(getErrorMessage(reason));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    products,
    currency,
    itemCategories,
    categories,
    error,
    saving,
    actionError,
    clearActionError: () => setActionError(null),
    saveProduct: (id: string | null, body: Record<string, unknown>) =>
      act(() =>
        id
          ? http.patch(End_Points.Personal_Product_Endpoint(id), body)
          : http.post(End_Points.Personal_Products_Endpoint(), body),
      ),
    saveItemCategory: (id: string | null, body: Record<string, unknown>) =>
      act(() =>
        id
          ? http.patch(End_Points.Personal_Item_Category_Endpoint(id), body)
          : http.post(End_Points.Personal_Item_Categories_Endpoint(), body),
      ),
    saveCategory: (id: string | null, body: Record<string, unknown>) =>
      act(() =>
        id
          ? http.patch(End_Points.Personal_Expense_Category_Endpoint(id), body)
          : http.post(End_Points.Personal_Expense_Categories_Endpoint(), body),
      ),
    // As categorias por omissão que faltam; devolve quantas entraram (nulo se falhou)
    addDefaultCategories: async () => {
      let added = 0;
      const ok = await act(async () => {
        const response = await http.post<{ added: number }>(End_Points.Personal_Expense_Category_Defaults_Endpoint());
        added = response.data.added;
      });
      return ok ? added : null;
    },
  };
};

/**
 * As subscrições: cada uma e os pagamentos dela, dos 3 meses para trás aos
 * `months` à frente, com o gravar, o apagar e o marcar (ou desmarcar) um
 * período como pago. Também as categorias das despesas e as contas pessoais.
 */
export const useSubscriptions = (months: number, currencyId: string | undefined) => {
  const [data, setData] = useState<Subscriptions_Data | null>(null);
  const [categories, setCategories] = useState<Expense_Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Personal_Bank_Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      http.get<Subscriptions_Data>(End_Points.Personal_Subscriptions_Endpoint(), {
        params: { months, currencyId: currencyId || undefined },
      }),
      http.get<Expense_Category[]>(End_Points.Personal_Expense_Categories_Endpoint()),
    ])
      .then(([subscriptionsResponse, categoriesResponse]) => {
        if (cancelled) return;
        setData(subscriptionsResponse.data);
        setCategories(categoriesResponse.data);
        setError(null);
      })
      .catch((reason) => {
        if (!cancelled) setError(getErrorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [months, currencyId, version]);

  useEffect(() => {
    http
      .get<Personal_Bank_Account[]>(End_Points.Bank_Account_Endpoint())
      .then((response) => setBankAccounts(response.data))
      .catch(() => setBankAccounts([]));
  }, []);

  const act = async (request: () => Promise<unknown>) => {
    setSaving(true);
    setActionError(null);
    try {
      await request();
      setVersion((current) => current + 1);
      return true;
    } catch (reason) {
      setActionError(getErrorMessage(reason));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    data,
    categories,
    bankAccounts,
    error,
    saving,
    actionError,
    clearActionError: () => setActionError(null),
    saveSubscription: (id: string | null, body: Record<string, unknown>) =>
      act(() =>
        id
          ? http.patch(End_Points.Personal_Subscription_Endpoint(id), body)
          : http.post(End_Points.Personal_Subscriptions_Endpoint(), body),
      ),
    deleteSubscription: (id: string) => act(() => http.delete(End_Points.Personal_Subscription_Endpoint(id))),
    pay: (id: string, period: string) => act(() => http.post(End_Points.Personal_Subscription_Pay_Endpoint(id), { period })),
    unpay: (id: string, period: string) => act(() => http.delete(End_Points.Personal_Subscription_Unpay_Endpoint(id, period))),
  };
};
