import { useEffect, useState } from 'react';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAsyncRequest } from '../useAsyncRequest';

export interface Company {
  id: string;
  name: string;
  slug: string;
  createdById: string;
  parentId: string | null;
  countryId: string | null;
  currencyId: string;
  // active | inactive — apagadas nunca chegam ao frontend
  status: string;
  createdAt: string;
  updatedAt: string;
  role: 'owner' | 'member';
  country: {
    id: string;
    name: string;
    iso2: string;
    currency: string;
    emoji: string | null;
  } | null;
  // A moeda em que as contas desta empresa significam alguma coisa. Vem
  // inteira para se poder formatar sem cruzar com a lista global de moedas.
  currency: {
    id: string;
    name: string;
    shortCode: string;
    symbol: string;
    symbolFirst: boolean;
    decimalMark: string;
    thousandsSeparator: string;
  };
  parent: { id: string; name: string } | null;
}

export const useCompanies = () => {
  const [companies, setCompanies] = useState<Company[]>([]);

  const { loading, run } = useAsyncRequest(true);

  const fetchCompanies = async () => {
    const response = await run(() => http.get(End_Points.Companies_Endpoint()));

    if (response) setCompanies(response.data);
  };

  useEffect(() => {
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { companies, loading, refresh: fetchCompanies };
};
