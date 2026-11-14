import { useEffect, useState } from 'react';
import http from '../Service/httpService';
import { End_Points } from '../Service/endPoints';
import { useAsyncRequest } from './useAsyncRequest';

export interface Country {
  id: string;
  name: string;
  iso2: string;
  currency: string;
  emoji: string | null;
}

export const useCountries = () => {
  const [countries, setCountries] = useState<Country[]>([]);

  const { loading, run } = useAsyncRequest(true);

  useEffect(() => {
    const fetchCountries = async () => {
      const response = await run(() => http.get(End_Points.Countries_Endpoint()));

      if (response) setCountries(response.data);
    };

    fetchCountries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { countries, loading };
};
