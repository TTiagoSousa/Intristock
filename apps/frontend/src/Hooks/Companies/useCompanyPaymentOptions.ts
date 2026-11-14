import { useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAsyncRequest } from '../useAsyncRequest';

// O que basta para escolher uma compra numa lista: nem o valor nem as linhas
// interessam a quem só quer dizer "este ativo veio daqui"
export interface CompanyPaymentOption {
  id: string;
  reference: string | null;
  paymentDate: string;
  paymentType: 'pay' | 'receive' | 'internal_transfer';
  supplier: { id: string; name: string } | null;
}

// O `GET /payments` é paginado e a lista vem por data descendente. Aqui pede-se
// o máximo que o backend aceita de uma vez: numa empresa com mais de 100
// pagamentos, os mais antigos não aparecem no seletor — e a compra que se quer
// ligar a um ativo é quase sempre das últimas.
const MAX_OPTIONS = 100;

export const useCompanyPaymentOptions = (companyId: string | undefined) => {
  const [payments, setPayments] = useState<CompanyPaymentOption[]>([]);
  const { loading, run } = useAsyncRequest(true);

  useEffect(() => {
    const fetchPayments = async () => {
      if (!companyId) return;

      const response = await run(() =>
        http.get(End_Points.Company_Payments_Endpoint(companyId), {
          params: { take: MAX_OPTIONS },
        }),
      );

      if (response) setPayments(response.data.items);
    };

    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  return { payments, loading };
};
