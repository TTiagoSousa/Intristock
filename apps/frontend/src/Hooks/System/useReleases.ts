import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import { useAsyncRequest } from '../useAsyncRequest';
import type { ReleaseList, VersionOverview } from './types';

/**
 * O que está instalado e a lista de versões, com as notas na língua da
 * interface. `refresh` vai buscar tags novas ao repositório na hora, em vez de
 * esperar pelos 5 minutos da cache do backend.
 */
export const useReleases = () => {
  const [overview, setOverview] = useState<VersionOverview | null>(null);
  const [list, setList] = useState<ReleaseList | null>(null);
  const { loading, run } = useAsyncRequest(true);
  const { i18n } = useTranslation();

  const fetchReleases = async (refresh = false) => {
    const lang = i18n.language;
    const response = await run(() =>
      Promise.all([
        http.get<VersionOverview>(End_Points.System_Version_Endpoint(), { params: { lang } }),
        http.get<ReleaseList>(End_Points.System_Releases_Endpoint(), {
          params: { lang, ...(refresh ? { refresh: 1 } : {}) },
        }),
      ]),
    );

    if (response) {
      setOverview(response[0].data);
      setList(response[1].data);
    }
  };

  useEffect(() => {
    fetchReleases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  return { overview, list, loading, fetchReleases };
};
