import { useEffect, useRef } from 'react';

/**
 * Corre `callback` de `ms` em `ms` só com o separador à vista: escondido, para
 * (não gasta pedidos nem bateria); ao voltar, corre logo e retoma o intervalo.
 * Com `ms` nulo não corre nada (o polling está desligado).
 */
export const useVisibleInterval = (callback: () => void, ms: number | null) => {
  const saved = useRef(callback);

  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (ms === null) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer === null) timer = setInterval(() => saved.current(), ms);
    };
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        saved.current();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ms]);
};
