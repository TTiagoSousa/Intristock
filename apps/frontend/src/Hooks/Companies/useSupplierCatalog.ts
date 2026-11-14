import { useCallback, useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { getErrorMessage } from '../useAsyncRequest';

// As categorias do catálogo de fornecedores (o tipo da plataforma). Só as prop
// firms têm já fornecedores; as outras aparecem como "Em breve"
export const SUPPLIER_CATALOG_CATEGORIES = ['prop_firm', 'bank', 'broker', 'exchange'] as const;
export type Supplier_Catalog_Category = (typeof SUPPLIER_CATALOG_CATEGORIES)[number];
export const AVAILABLE_CATALOG_CATEGORIES: Supplier_Catalog_Category[] = ['prop_firm'];

export interface Supplier_Catalog_Supplier {
  id: string;
  slug: string;
}

export interface Supplier_Catalog_Entry {
  id: string;
  name: string;
  logo: string | null;
  website: string | null;
  country: string | null;
  // A nota da PropFirmMap (0–10)
  score: number | null;
  // O fornecedor desta empresa que já veio daqui
  supplier: Supplier_Catalog_Supplier | null;
}

/** As plataformas de uma categoria do catálogo e o criar um fornecedor a partir de uma. */
export const useSupplierCatalog = (companyId: string, category: Supplier_Catalog_Category | null) => {
  // A lista e a categoria a que pertence: enquanto não for a pedida, está a carregar
  const [result, setResult] = useState<{ category: string; entries: Supplier_Catalog_Entry[] } | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!category) return;
    let cancelled = false;
    http
      .get<Supplier_Catalog_Entry[]>(End_Points.Company_Supplier_Catalog_Endpoint(companyId), {
        params: { type: category },
      })
      .then(({ data }) => {
        if (cancelled) return;
        setResult({ category, entries: data });
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setResult({ category, entries: [] });
        setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, category]);

  // Devolve o fornecedor criado (para abrir a página dele ou voltar com ele escolhido)
  const createFromPlatform = useCallback(
    async (platformId: string) => {
      setCreating(platformId);
      setError(null);
      try {
        const { data } = await http.post<Supplier_Catalog_Supplier>(
          End_Points.Company_Supplier_From_Platform_Endpoint(companyId),
          { platformId },
        );
        return { id: data.id, slug: data.slug };
      } catch (err) {
        setError(getErrorMessage(err));
        return null;
      } finally {
        setCreating(null);
      }
    },
    [companyId],
  );

  const loading = category !== null && result?.category !== category;
  const entries = !loading && result ? result.entries : [];
  return { entries, loading, creating, error, createFromPlatform };
};
