import { useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import type { Company_Members } from './useCompanyAccessAdmin';
import type { Upcoming_Payment } from './useUpcomingPayments';

// Até onde se procuram os salários e recibos por pagar, para escolher no formulário
const UPCOMING_MONTHS = 12;

/**
 * Para o formulário de um pagamento a um membro: os membros e o que está por
 * pagar a cada um (para ligar o pagamento a um salário ou recibo verde). Só se
 * pede com `companyId`; sem permissão para ver uma das listas, essa vem vazia.
 */
export const usePaymentMemberOptions = (companyId: string | undefined) => {
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [upcoming, setUpcoming] = useState<Upcoming_Payment[]>([]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;

    http
      .get<Company_Members>(End_Points.Company_Members_Endpoint(companyId))
      .then((response) => {
        if (!cancelled) setMembers(response.data.members.map((member) => ({ id: member.id, name: member.name })));
      })
      .catch(() => undefined);

    http
      .get<Upcoming_Payment[]>(End_Points.Company_Upcoming_Payments_Endpoint(companyId), {
        params: { months: UPCOMING_MONTHS },
      })
      .then((response) => {
        if (!cancelled) setUpcoming(response.data);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return { members, upcoming };
};
