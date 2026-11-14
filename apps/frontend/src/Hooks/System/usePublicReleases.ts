import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import http from '../../Service/httpService';
import { End_Points } from '../../Service/endPoints';
import type { PublicReleaseList } from './types';

/** As versões e as novidades de cada uma, na língua da interface (todos os utilizadores). */
export const usePublicReleases = () => {
  const { i18n } = useTranslation();
  const language = i18n.language;
  // A lista guarda a língua em que veio: ao mudar de língua volta a "a carregar"
  const [loaded, setLoaded] = useState<{ language: string; list: PublicReleaseList | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    http
      .get<PublicReleaseList>(End_Points.Versions_Endpoint(), { params: { lang: language } })
      .then(({ data }) => {
        if (!cancelled) setLoaded({ language, list: data });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ language, list: null });
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const ready = loaded?.language === language;
  return { list: ready ? loaded.list : null, loading: !ready };
};
