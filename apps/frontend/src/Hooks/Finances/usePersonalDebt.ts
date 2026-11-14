import { useCallback, useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { getErrorMessage } from '../useAsyncRequest';
import type { Income_Currency, Personal_Bank_Account } from './usePersonalIncome';

export const DEBT_KINDS = ['mortgage', 'car', 'personal', 'credit_card', 'student', 'consumer', 'family', 'tax', 'other'] as const;
export type Debt_Kind = (typeof DEBT_KINDS)[number];
export type Debt_Direction = 'owe' | 'lent';
export type Debt_Status = 'active' | 'paid_off' | 'closed';
export const DEBT_MOVEMENT_KINDS = ['installment', 'extra', 'charge'] as const;
export type Debt_Movement_Kind = (typeof DEBT_MOVEMENT_KINDS)[number];

export interface Personal_Debt {
  id: string;
  direction: Debt_Direction;
  kind: Debt_Kind;
  name: string;
  counterparty: string | null;
  platformId: string | null;
  platform: { id: string; name: string; logo: string | null } | null;
  currencyId: string;
  currency: Income_Currency;
  principal: number;
  openingBalance: number;
  openingDate: string;
  interestRate: number | null;
  rateType: 'fixed' | 'variable' | null;
  installment: number | null;
  paymentDay: number | null;
  startDate: string;
  endDate: string | null;
  bankAccountId: string | null;
  bankAccount: { id: string; name: string } | null;
  status: Debt_Status;
  notes: string | null;
  // Calculados no backend
  balance: number;
  paid: number;
  paidPrincipal: number;
  interestPaid: number;
  feesPaid: number;
  charged: number;
  lastPayment: string | null;
  paidPct: number;
  projectedEnd: string | null;
  movementsCount: number;
}

export interface Debt_Movement {
  id: string;
  debtId: string;
  debt: { id: string; name: string; kind: Debt_Kind; direction: Debt_Direction; currency: Income_Currency };
  kind: Debt_Movement_Kind;
  date: string;
  amount: number;
  principalPart: number | null;
  interestPart: number | null;
  feesPart: number | null;
  period: string | null;
  bankAccountId: string | null;
  bankAccount: { id: string; name: string } | null;
  notes: string | null;
}

// Uma prestação por pagar (calculada no backend)
export interface Debt_Due {
  debtId: string;
  name: string;
  kind: Debt_Kind;
  direction: Debt_Direction;
  period: string;
  date: string;
  overdue: boolean;
  amount: number;
  interestEstimate: number | null;
  currency: Income_Currency;
}

export interface Debt_Summary {
  currency: Income_Currency | null;
  // Os dias (de uma moeda) convertidos pela cotação de referência, por não haver a do dia
  estimatedRates: number;
  months: { month: string; owed: number; lent: number; paid: number; interest: number; future: boolean }[];
  cards: {
    owed: number;
    lent: number;
    activeCount: number;
    monthlyInstallments: number;
    paidThisMonth: number;
    paidYear: number;
    interestYear: number;
    dueTotal: number;
    dueCount: number;
    overdueCount: number;
    nextPayoff: { name: string; month: string } | null;
  };
  byKind: { kind: Debt_Kind; total: number }[];
  debts: {
    id: string;
    name: string;
    kind: Debt_Kind;
    direction: Debt_Direction;
    balance: number;
    principal: number;
    paidPct: number;
    projectedEnd: string | null;
    installment: number | null;
    currency: Income_Currency;
  }[];
  upcoming: Debt_Due[];
}

export interface Debt_Bank {
  id: string;
  name: string;
  type: string;
}

export interface Debt_Movement_Filters {
  debtId: string;
  kind: string;
  from: string;
  to: string;
}

/** O dashboard das dívidas, contado no backend na moeda pedida. */
// Com `range` (meses `YYYY-MM`), o gráfico é desse intervalo no lugar de `months` e `future`; os cartões não mudam
export const useDebtSummary = (
  months: number,
  future: number,
  currencyId: string | undefined,
  range: { from: string; to: string } | null = null,
) => {
  const [data, setData] = useState<Debt_Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const from = range?.from;
  const to = range?.to;

  useEffect(() => {
    let cancelled = false;
    http
      .get<Debt_Summary>(End_Points.Personal_Debt_Summary_Endpoint(), {
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
 * O registo das dívidas: as dívidas, as prestações por pagar, os movimentos
 * (com os filtros), os bancos e as contas pessoais, com o gravar e o apagar.
 * Depois de gravar, volta a pedir tudo.
 */
export const useDebtRegister = (filters: Debt_Movement_Filters, dueMonths: number) => {
  const [debts, setDebts] = useState<Personal_Debt[] | null>(null);
  const [due, setDue] = useState<Debt_Due[] | null>(null);
  const [movements, setMovements] = useState<Debt_Movement[] | null>(null);
  const [banks, setBanks] = useState<Debt_Bank[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Personal_Bank_Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);
  const { debtId, kind, from, to } = filters;

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      http.get<Personal_Debt[]>(End_Points.Personal_Debts_Endpoint()),
      http.get<Debt_Due[]>(End_Points.Personal_Debts_Due_Endpoint(), { params: { months: dueMonths } }),
      http.get<Debt_Movement[]>(End_Points.Personal_Debt_Movements_Endpoint(), {
        params: {
          debtId: debtId || undefined,
          kind: kind || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      }),
    ])
      .then(([debtsResponse, dueResponse, movementsResponse]) => {
        if (cancelled) return;
        setDebts(debtsResponse.data);
        setDue(dueResponse.data);
        setMovements(movementsResponse.data);
        setError(null);
      })
      .catch((reason) => {
        if (!cancelled) setError(getErrorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [debtId, kind, from, to, dueMonths, version]);

  // Os bancos e as contas mudam pouco: uma vez
  useEffect(() => {
    http
      .get<Debt_Bank[]>(End_Points.Platforms_Endpoint())
      .then((response) => setBanks(response.data.filter((platform) => platform.type === 'bank')))
      .catch(() => setBanks([]));
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
    debts,
    due,
    movements,
    banks,
    bankAccounts,
    error,
    saving,
    actionError,
    clearActionError: () => setActionError(null),
    saveDebt: (id: string | null, body: Record<string, unknown>) =>
      act(() => (id ? http.patch(End_Points.Personal_Debt_Endpoint(id), body) : http.post(End_Points.Personal_Debts_Endpoint(), body))),
    deleteDebt: (id: string) => act(() => http.delete(End_Points.Personal_Debt_Endpoint(id))),
    saveMovement: (id: string | null, body: Record<string, unknown>) =>
      act(() =>
        id
          ? http.patch(End_Points.Personal_Debt_Movement_Endpoint(id), body)
          : http.post(End_Points.Personal_Debt_Movements_Endpoint(), body),
      ),
    deleteMovement: (id: string) => act(() => http.delete(End_Points.Personal_Debt_Movement_Endpoint(id))),
  };
};
