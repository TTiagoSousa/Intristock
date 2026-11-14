import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAlert } from '../../Contexts/Alert_Context';
import { useAsyncRequest } from '../useAsyncRequest';
import type { Platform } from '../usePlatforms';

export interface Admin_Platform extends Platform {
  countryId: string | null;
}

export interface CreatePlatformPayload {
  name: string;
  type: Platform['type'];
  website?: string;
  countryId?: string;
}

/** O catálogo de plataformas (bancos, corretoras, exchanges, correios): ver e acrescentar. */
export const useAdminPlatforms = () => {
  const [platforms, setPlatforms] = useState<Admin_Platform[]>([]);
  const { loading, run } = useAsyncRequest(true);
  const { loading: saving, run: runSave } = useAsyncRequest();
  const { setAlert } = useAlert();
  const { t } = useTranslation();

  const refresh = async () => {
    const response = await run(() => http.get<Admin_Platform[]>(End_Points.Platforms_Endpoint()));
    if (response) setPlatforms(response.data);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createPlatform = async (payload: CreatePlatformPayload): Promise<boolean> => {
    const response = await runSave(() => http.post(End_Points.Platforms_Endpoint(), payload));
    if (!response) return false;

    await refresh();
    setAlert({ open: true, message: t('adminPlatforms.created'), type: 'success' });
    return true;
  };

  return { platforms, loading, saving, createPlatform };
};
