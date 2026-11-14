import { useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import type { CompanyItem } from './useCompanyItems';

/**
 * Um item pelo slug do URL (…/itens/filamento-pla), para a página de
 * editar. `notFound` distingue "não existe" de "ainda a carregar".
 */
export const useCompanyItem = (companyId: string | undefined, slug: string | undefined) => {
  const [item, setItem] = useState<CompanyItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!companyId || !slug) return;

    // Trocar de item a meio do pedido não pode deixar a resposta do
    // anterior por cima do novo
    let cancelled = false;

    http
      .get(End_Points.Company_Item_Endpoint(companyId, slug))
      .then((response) => {
        if (cancelled) return;
        setItem(response.data);
        setNotFound(false);
      })
      .catch(() => {
        if (cancelled) return;
        setItem(null);
        setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, slug]);

  return { item, loading, notFound };
};
