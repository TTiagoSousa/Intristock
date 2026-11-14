import { useEffect, useMemo, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAsyncRequest } from '../useAsyncRequest';

export interface Tax {
  id: string;
  countryId: string;
  name: string;
  description: string | null;
  // Percentagem: 23 = 23%
  rate: number;
  category: string;
  type: string;
  isActive: boolean;
  country: { id: string; name: string; iso2: string } | null;
}

/**
 * Traz o catálogo todo — de todos os países — e põe à cabeça os do país da
 * empresa. Filtrar pelo país escondia impostos que às vezes são mesmo precisos
 * (uma fatura de um fornecedor estrangeiro), e a pesquisa do dropdown trata do
 * resto.
 */
export const useTaxes = (companyCountryId: string | null | undefined) => {
  const [taxes, setTaxes] = useState<Tax[]>([]);

  const { loading, run } = useAsyncRequest(true);

  const fetchTaxes = async () => {
    const response = await run(() => http.get(End_Points.Taxes_Endpoint()));

    if (response) setTaxes(response.data);
  };

  useEffect(() => {
    fetchTaxes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Primeiro os do país da empresa, taxa mais alta primeiro; depois os
  // restantes agrupados por país, para a lista não ficar às três pancadas
  const sortedTaxes = useMemo(() => {
    return [...taxes].sort((a, b) => {
      const aLocal = a.countryId === companyCountryId;
      const bLocal = b.countryId === companyCountryId;

      if (aLocal !== bLocal) return aLocal ? -1 : 1;

      if (!aLocal) {
        const countryOrder = (a.country?.name ?? '').localeCompare(b.country?.name ?? '');

        if (countryOrder !== 0) return countryOrder;
      }

      return b.rate - a.rate;
    });
  }, [taxes, companyCountryId]);

  return { taxes: sortedTaxes, loading, refresh: fetchTaxes };
};
