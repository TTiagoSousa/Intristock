import { useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import type { CompanySupplier } from './useCompanySuppliers';

/**
 * Um fornecedor pelo slug do URL (…/fornecedores/iq-capital), para a página de
 * editar. `notFound` distingue "não existe" de "ainda a carregar".
 */
export const useCompanySupplier = (companyId: string | undefined, slug: string | undefined) => {
  const [supplier, setSupplier] = useState<CompanySupplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!companyId || !slug) return;

    // Trocar de fornecedor a meio do pedido não pode deixar a resposta do
    // anterior por cima do novo
    let cancelled = false;

    http
      .get(End_Points.Company_Supplier_Endpoint(companyId, slug))
      .then((response) => {
        if (cancelled) return;
        setSupplier(response.data);
        setNotFound(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSupplier(null);
        setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, slug]);

  return { supplier, loading, notFound };
};
