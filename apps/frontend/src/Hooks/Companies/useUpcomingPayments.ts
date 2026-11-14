import { useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { getErrorMessage } from '../useAsyncRequest';

export interface Upcoming_Payment {
  memberId: string;
  memberName: string;
  memberPayId: string;
  kind: 'salary' | 'freelance';
  // O que se paga: o salário do mês, um subsídio ou o recibo verde
  part: 'salary' | 'holiday' | 'christmas' | 'freelance';
  period: string;
  date: string;
  overdue: boolean;
  description: string | null;
  grossAmount: number;
  // O que sai do banco num recibo verde (o bruto menos a retenção)
  netAmount: number;
  withholdingPct: number | null;
  currency: { id: string; shortCode: string; symbol: string };
  bankAccountId: string | null;
}

/**
 * Os salários e recibos verdes por pagar, dos em atraso aos dos próximos
 * `months` meses. Calculados no backend; `reload` depois de registar um.
 */
export const useUpcomingPayments = (companyId: string | undefined, months: number) => {
  const [data, setData] = useState<Upcoming_Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    http
      .get<Upcoming_Payment[]>(End_Points.Company_Upcoming_Payments_Endpoint(companyId), { params: { months } })
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
  }, [companyId, months, version]);

  return { data, error, reload: () => setVersion((current) => current + 1) };
};
