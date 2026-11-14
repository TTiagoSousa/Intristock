import { useEffect, useState } from 'react';

/** A hora atual (ms), a mudar de `everyMs` em `everyMs` enquanto `active`. */
export const useNow = (active: boolean, everyMs = 1000) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [active, everyMs]);

  return now;
};
