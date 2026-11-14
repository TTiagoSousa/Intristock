import { useEffect, useState } from 'react';
import http from '../Service/httpService';
import { End_Points } from '../Service/endPoints';
import { useAsyncRequest } from './useAsyncRequest';

export interface Platform {
  id: string;
  name: string;
  type: 'bank' | 'broker' | 'exchange' | 'postal' | 'prop_firm';
  logo: string | null;
  website: string | null;
  // De onde veio: `system` (catálogo), `manual` (o admin) ou a API que a mantém (`propfirmmap`)
  source: string;
  syncedAt: string | null;
}

export const usePlatforms = () => {
  const [platforms, setPlatforms] = useState<Platform[]>([]);

  const { loading, run } = useAsyncRequest(true);

  useEffect(() => {
    const fetchPlatforms = async () => {
      const response = await run(() => http.get(End_Points.Platforms_Endpoint()));

      if (response) setPlatforms(response.data);
    };

    fetchPlatforms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { platforms, loading };
};
