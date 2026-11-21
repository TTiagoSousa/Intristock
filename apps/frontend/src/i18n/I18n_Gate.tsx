import { useEffect, useState, type ReactNode } from 'react';
import { i18nReady } from './i18n';
import { Loading_Page } from '../Imports/intermediaryPages';

// O primeiro ecrã só aparece com as traduções da língua ativa carregadas (vêm num
// ficheiro à parte); até lá fica o fundo da app, sem nada por cima
const I18n_Gate = ({ children }: { children: ReactNode }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    i18nReady.finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);
  return ready ? children : <Loading_Page />;
};

export default I18n_Gate;
