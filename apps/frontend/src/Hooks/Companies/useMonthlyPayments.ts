import { useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { getErrorMessage } from '../useAsyncRequest';

// Um mês (`month` = "2026-10"): o que se pagou e o que se recebeu, já na moeda da empresa
export interface MonthlyPayments {
  month: string;
  pay: number;
  receive: number;
  payCount: number;
  receiveCount: number;
  // O que já se sabe que vem e não está registado: salários e recibos verdes por pagar
  plannedPay: number;
  plannedCount: number;
  // Um mês depois do atual
  future: boolean;
}

// Os filtros que vão ao backend. Com `from` e `to` (YYYY-MM) o intervalo é esse;
// sem eles, os últimos `months` mais `future` meses à frente.
export interface MonthlyPaymentsFilters {
  months: number;
  future: number;
  from: string;
  to: string;
  supplierId: string;
  supplierGroupId: string;
  includeDrafts: boolean;
}

/** Pagos, recebidos e previstos de cada mês, contados no backend. */
export const useMonthlyPayments = (companyId: string | undefined, filters: MonthlyPaymentsFilters) => {
  const [data, setData] = useState<MonthlyPayments[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { months, future, from, to, supplierId, supplierGroupId, includeDrafts } = filters;
  const custom = Boolean(from && to);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    http
      .get<MonthlyPayments[]>(End_Points.Company_Monthly_Payments_Endpoint(companyId), {
        params: {
          ...(custom ? { from, to } : { months, future: future || undefined }),
          supplierId: supplierId || undefined,
          supplierGroupId: supplierGroupId || undefined,
          includeDrafts: includeDrafts || undefined,
        },
      })
      .then((response) => {
        if (cancelled) return;
        setData(response.data);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, custom, months, future, from, to, supplierId, supplierGroupId, includeDrafts]);

  return { data, error };
};
