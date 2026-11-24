import { useCallback, useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { getErrorMessage } from '../useAsyncRequest';

type Company_Ref = { id: string; name: string; slug: string };

/** O cruzamento de um pagamento da empresa com os ganhos da pessoa. */
/// `declined`: a pessoa respondeu «Não recebi» (já não está por responder)
export type Payment_Check = 'awaiting' | 'confirmed' | 'different' | 'declined';
export type Payment_Source = 'company_payment' | 'time_tracking';

export interface Invitations {
  invites: { id: string; company: Company_Ref; roleName: string | null; invitedBy: string | null; invitedAt: string | null }[];
  proposals: {
    id: string;
    company: Company_Ref;
    kind: 'salary' | 'freelance';
    description: string | null;
    grossAmount: number;
    currency: string;
    paymentsPerYear: number | null;
    payDay: number | null;
    startDate: string | null;
    endDate: string | null;
    dueDate: string | null;
    withholdingPct: number | null;
    previous: { grossAmount: number; startDate: string | null } | null;
    proposedBy: string | null;
    createdAt: string;
  }[];
  payments: {
    source: Payment_Source;
    id: string;
    company: Company_Ref;
    description: string | null;
    kind: string | null;
    period: string | null;
    seconds?: number;
    date: string;
    amount: number;
    currency: string;
    incomeAmount: number | null;
    check: Payment_Check;
  }[];
}

// Lançado depois de cada resposta: o sino e a página «Convites» voltam a pedir,
// para quem respondeu num não ficar com os botões ativos no outro
export const INVITATIONS_CHANGED_EVENT = 'invitations:changed';
const changed = <T,>(response: { data: T }) => {
  window.dispatchEvent(new Event(INVITATIONS_CHANGED_EVENT));
  return response.data;
};

/** O que as empresas pedem a esta pessoa (página «Convites e propostas» e os botões do sino). */
export const invitationsApi = {
  respondInvite: (memberId: string, accept: boolean) =>
    http.post(End_Points.Invitation_Member_Endpoint(memberId), { accept }).then(changed),
  respondProposal: (payId: string, accept: boolean, note?: string) =>
    http.post(End_Points.Invitation_Pay_Endpoint(payId), { accept, note }).then(changed),
  confirmPayment: (source: Payment_Source, id: string, received: boolean) =>
    http.post(End_Points.Invitation_Payment_Endpoint(id), { source, received }).then(changed),
};

export const useInvitations = () => {
  const [data, setData] = useState<Invitations | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const response = await http.get<Invitations>(End_Points.Invitations_Endpoint());
      setData(response.data);
      setError(null);
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Uma resposta dada no sino também muda esta página
  useEffect(() => {
    const onChanged = () => void reload();
    window.addEventListener(INVITATIONS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(INVITATIONS_CHANGED_EVENT, onChanged);
  }, [reload]);

  return { data, error, reload };
};
