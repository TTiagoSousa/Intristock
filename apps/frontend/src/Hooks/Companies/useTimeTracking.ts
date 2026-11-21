import { useCallback, useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { getErrorMessage } from '../useAsyncRequest';

/** O fuso do browser: os dias e os meses das horas contam-se nele. */
export const browserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

export interface Time_Currency {
  id: string;
  shortCode: string;
  symbol: string;
}

export interface Time_Connection {
  id: string;
  provider: 'solidtime';
  baseUrl: string;
  organizationId: string;
  organizationName: string;
  status: 'active' | 'error' | 'paused';
  syncEveryHours: number;
  lastError: string | null;
  syncedAt: string | null;
  createdAt: string;
  currency: Time_Currency;
  _count: { clients: number; projects: number; people: number; entries: number };
  syncing: boolean;
}

export interface Time_Organization {
  id: string;
  name: string;
  currency: string;
  role: string;
}

export const CLIENT_BILLING = ['freelance', 'invoice', 'none'] as const;
export type Client_Billing = (typeof CLIENT_BILLING)[number];

export interface Time_Client {
  id: string;
  connectionId: string;
  organizationName: string;
  name: string;
  isArchived: boolean;
  supplier: { id: string; name: string; slug: string } | null;
  hourlyRate: number | null;
  billing: Client_Billing;
  withholdingPct: number | null;
  // As horas que o cliente pagou adiantadas e ainda não se gastaram
  creditSeconds: number;
  creditAmount: number;
  projects: { id: string; name: string; color: string | null; billableRate: number | null; isBillable: boolean; isArchived: boolean }[];
}

export interface Time_Person {
  id: string;
  connectionId: string;
  organizationName: string;
  name: string;
  billableRate: number | null;
  // O que a empresa lhe paga por hora (nulo = o valor das horas) e a retenção disso
  payRate: number | null;
  payWithholdingPct: number | null;
  member: { id: string; name: string | null; hasAccount: boolean } | null;
  owner: boolean;
}

export interface Hours_Totals {
  seconds: number;
  billableSeconds: number;
  amount: number;
  paidSeconds: number;
  paidAmount: number;
  unpaidSeconds: number;
  unpaidAmount: number;
  entries: number;
}

export type Hours_Group = 'month' | 'day' | 'client';

export interface Hours_Summary {
  currency: Time_Currency | null;
  from: string;
  to: string;
  group: Hours_Group;
  totals: Hours_Totals;
  rows: (Hours_Totals & { period: string | null; client: { id: string; name: string } | null })[];
}

export interface Time_Entry {
  id: string;
  start: string;
  end: string | null;
  seconds: number;
  description: string | null;
  billable: boolean;
  client: { id: string; name: string } | null;
  project: { id: string; name: string; color: string | null } | null;
  person: { id: string; name: string } | null;
  rate: number;
  amount: number;
  // Pago pelo cliente à empresa
  paidSeconds: number;
  unpaidAmount: number;
  // Pago pela empresa a quem fez as horas
  payoutSeconds: number;
}

export interface Time_Summary {
  currency: Time_Currency | null;
  connections: number;
  months: { month: string; seconds: number; amount: number; paid: number; unpaid: number; byClient: Record<string, number> }[];
  cards: {
    secondsThisMonth: number;
    secondsPreviousMonth: number;
    amountThisMonth: number;
    amountPreviousMonth: number;
    amountPeriod: number;
    received: number;
    receivedGross: number;
    receivedThisMonth: number;
    pending: number;
    pendingSeconds: number;
    pendingClients: number;
  };
  byClient: { key: string; id: string | null; name: string | null; seconds: number; amount: number; unpaid: number }[];
  settlements: {
    id: string;
    client: { id: string; name: string };
    paidAt: string;
    seconds: number;
    grossAmount: number;
    netAmount: number;
    // O recebimento ficou gravado na empresa
    recorded: boolean;
  }[];
}

/** O cruzamento de um pagamento à pessoa com os ganhos dela (ver `payoutView` no backend). */
export type Payout_Check = 'received' | 'awaiting' | 'different' | 'none';

/** O que a empresa pagou a quem fez as horas. */
export interface Time_Payout {
  id: string;
  company: { id: string; name: string; slug: string };
  person: { id: string; name: string };
  user: { id: string; fullName: string } | null;
  paidAt: string;
  seconds: number;
  hourlyRate: number;
  grossAmount: number;
  withholdingPct: number | null;
  netAmount: number;
  currency: Time_Currency;
  note: string | null;
  companyPayment: { id: string; amount: number; status: string } | null;
  personalIncome: { id: string; amount: number } | null;
  check: Payout_Check;
  createdAt: string;
}

export interface Payout_Input {
  personId?: string;
  entryIds?: string[];
  fromDate?: string;
  toDate?: string;
  amount?: number;
  withholdingPct?: number | null;
  paidAt: string;
  fromBankAccountId?: string;
  note?: string;
}

export interface Time_Settlement {
  id: string;
  mode: 'range' | 'hours' | 'entries';
  company: { id: string; name: string; slug: string };
  client: { id: string; name: string };
  person: { id: string; name: string } | null;
  user: { id: string; fullName: string } | null;
  fromDate: string | null;
  toDate: string | null;
  paidAt: string;
  seconds: number;
  allocatedSeconds: number;
  creditSeconds: number;
  hourlyRate: number;
  grossAmount: number;
  withholdingPct: number | null;
  netAmount: number;
  currency: Time_Currency;
  note: string | null;
  companyPayment: { id: string; amount: number; status: string } | null;
  createdAt: string;
}

export interface Settlement_Input {
  clientId: string;
  mode: 'range' | 'hours' | 'entries';
  entryIds?: string[];
  personId?: string;
  fromDate?: string;
  toDate?: string;
  hours?: number;
  amount?: number;
  withholdingPct?: number | null;
  paidAt: string;
  toBankAccountId?: string;
  note?: string;
}

const path = (companyId: string, rest: string) => End_Points.Time_Tracking_Endpoint(companyId, rest);

/**
 * Um GET que se refaz quando a chave muda (ou com `reload`). A resposta fica com a
 * chave do pedido: ao mudar de filtro, ou com um intervalo inválido (`url` nulo), as
 * linhas de antes deixam logo de aparecer (podiam escolher-se e pagar-se). Um
 * `reload` da mesma chave mantém-nas até chegar a resposta nova.
 */
const useResource = <T,>(url: string | null, params: Record<string, unknown>) => {
  const key = JSON.stringify(params);
  const id = url ? `${url}?${key}` : null;
  const [state, setState] = useState<{ id: string; data: T | null; error: string | null } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!url || !id) return;
    let cancelled = false;
    http
      .get<T>(url, { params: JSON.parse(key) })
      .then((response) => {
        if (!cancelled) setState({ id, data: response.data, error: null });
      })
      .catch((reason) => {
        if (!cancelled)
          setState((previous) => ({
            id,
            data: previous?.id === id ? previous.data : null,
            error: getErrorMessage(reason),
          }));
      });
    return () => {
      cancelled = true;
    };
  }, [url, key, id, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const current = state && state.id === id ? state : null;
  return { data: current?.data ?? null, error: current?.error ?? null, reload };
};

export const useTimeSummary = (companyId: string | undefined, months: number) =>
  useResource<Time_Summary>(companyId ? path(companyId, 'summary') : null, { months, tz: browserTimeZone() });

export const useTimeHours = (
  companyId: string | undefined,
  query: { from: string; to: string; clientId?: string; personId?: string; group: Hours_Group },
) =>
  useResource<Hours_Summary>(companyId && query.from && query.to ? path(companyId, 'hours') : null, {
    ...query,
    clientId: query.clientId || undefined,
    personId: query.personId || undefined,
    tz: browserTimeZone(),
  });

export const useTimeEntries = (
  companyId: string | undefined,
  query: { from: string; to: string; clientId?: string; personId?: string; status?: 'paid' | 'unpaid'; page: number },
) =>
  useResource<{ page: number; take: number; total: number; entries: Time_Entry[] }>(
    companyId && query.from && query.to ? path(companyId, 'entries') : null,
    {
      ...query,
      clientId: query.clientId || undefined,
      personId: query.personId || undefined,
      status: query.status || undefined,
      take: 20,
      tz: browserTimeZone(),
    },
  );

export const useTimeClients = (companyId: string | undefined) =>
  useResource<Time_Client[]>(companyId ? path(companyId, 'clients') : null, {});

export const useTimePeople = (companyId: string | undefined) =>
  useResource<Time_Person[]>(companyId ? path(companyId, 'people') : null, {});

export const useTimeSettlements = (companyId: string | undefined, query: { clientId?: string } = {}) =>
  useResource<Time_Settlement[]>(companyId ? path(companyId, 'settlements') : null, {
    clientId: query.clientId || undefined,
  });

export const useTimePayouts = (companyId: string | undefined, query: { personId?: string } = {}) =>
  useResource<Time_Payout[]>(companyId ? path(companyId, 'payouts') : null, {
    personId: query.personId || undefined,
  });

export const useTimeConnections = (companyId: string | undefined) =>
  useResource<Time_Connection[]>(companyId ? path(companyId, 'connections') : null, {});

// As escritas: devolvem a resposta ou atiram o erro (o ecrã mostra-o)
export const timeTrackingApi = {
  check: (companyId: string, body: { provider: 'solidtime'; baseUrl: string; token: string }) =>
    http
      .post<{ baseUrl: string; user: { id: string; name: string }; organizations: Time_Organization[] }>(
        path(companyId, 'connections/check'),
        body,
      )
      .then((response) => response.data),
  connect: (
    companyId: string,
    body: { provider: 'solidtime'; baseUrl: string; token: string; organizationId: string; syncEveryHours: number },
  ) => http.post<Time_Connection>(path(companyId, 'connections'), body).then((response) => response.data),
  updateConnection: (companyId: string, id: string, body: { paused?: boolean; syncEveryHours?: number; token?: string }) =>
    http.patch<Time_Connection>(path(companyId, `connections/${id}`), body).then((response) => response.data),
  deleteConnection: (companyId: string, id: string) => http.delete(path(companyId, `connections/${id}`)),
  sync: (companyId: string, id: string) =>
    http
      .post<{ entries: number; removed: number }>(path(companyId, `connections/${id}/sync`))
      .then((response) => response.data),
  updateClient: (
    companyId: string,
    id: string,
    body: {
      supplierId?: string | null;
      createSupplier?: 'individual' | 'company';
      hourlyRate?: number | null;
      billing?: Client_Billing;
      withholdingPct?: number | null;
    },
  ) => http.patch(path(companyId, `clients/${id}`), body),
  updatePerson: (
    companyId: string,
    id: string,
    body: { memberId?: string | null; owner?: boolean; payRate?: number | null; payWithholdingPct?: number | null },
  ) =>
    http.patch(path(companyId, `people/${id}`), body),
  settle: (companyId: string, body: Settlement_Input) =>
    http
      .post<Time_Settlement>(path(companyId, 'settlements'), { ...body, tz: browserTimeZone() })
      .then((response) => response.data),
  unsettle: (companyId: string, id: string) => http.delete(path(companyId, `settlements/${id}`)),
  payout: (companyId: string, body: Payout_Input) =>
    http
      .post<Time_Payout>(path(companyId, 'payouts'), { ...body, tz: browserTimeZone() })
      .then((response) => response.data),
  unpayout: (companyId: string, id: string) => http.delete(path(companyId, `payouts/${id}`)),
};

/** «12h 05m», «45m», «0m». */
export const formatDuration = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return `${hours}h ${String(rest).padStart(2, '0')}m`;
};
