import { useCallback, useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { getErrorMessage } from '../useAsyncRequest';

export interface Item_Catalog_Plan {
  id: string;
  // O nome que o item vai ter ("FTMO · 100 000 USD · 2-Step")
  name: string;
  step: string | null;
  accountSize: number | null;
  // O preço do plano, na moeda dele (a do catálogo, não a da empresa)
  price: number | null;
  currency: string | null;
  // O item desta empresa que já veio deste plano
  item: { id: string; slug: string } | null;
}

/** Os planos de uma plataforma do catálogo e o juntá-los como itens. */
export const useItemCatalog = (companyId: string, platformId: string) => {
  const [result, setResult] = useState<{ platformId: string; plans: Item_Catalog_Plan[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    http
      .get<{ plans: Item_Catalog_Plan[] }>(End_Points.Company_Item_Catalog_Plans_Endpoint(companyId, platformId))
      .then(({ data }) => {
        if (cancelled) return;
        setResult({ platformId, plans: data.plans });
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setResult({ platformId, plans: [] });
        setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, platformId]);

  // Devolve quantos itens entraram (null se falhou)
  const createFromPlans = useCallback(
    async (planIds: string[]) => {
      setSaving(true);
      setError(null);
      try {
        const { data } = await http.post<{ created: number; skipped: number }>(
          End_Points.Company_Items_From_Plans_Endpoint(companyId),
          { platformId, planIds },
        );
        return data.created;
      } catch (err) {
        setError(getErrorMessage(err));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [companyId, platformId],
  );

  const loading = result?.platformId !== platformId;
  return { plans: loading || !result ? [] : result.plans, loading, error, saving, createFromPlans };
};
