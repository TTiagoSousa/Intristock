import i18n, { type BackendModule } from 'i18next';
import { initReactI18next } from 'react-i18next';

// Cada língua num ficheiro à parte, que só se descarrega quando faz falta: a do
// arranque antes do primeiro ecrã (ver `i18nReady`) e a outra ao mudar de língua
// (o `changeLanguage` espera por ela, por isso nunca se veem as chaves)
const LOADERS: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  pt: () => import('../Locales/pt/translation.json'),
  en: () => import('../Locales/en/translation.json'),
};

const FALLBACK = 'pt';

const lazyTranslations: BackendModule = {
  type: 'backend',
  init: () => {},
  read: (language, _namespace, callback) => {
    const load = LOADERS[language];
    if (!load) return callback(null, {});
    load().then(
      (module) => callback(null, module.default),
      (error) => callback(error, null),
    );
  },
};

const stored = localStorage.getItem('language');

// Resolve quando a língua ativa (e a de recurso, se for outra) já está carregada
export const i18nReady = i18n
  .use(lazyTranslations)
  .use(initReactI18next)
  .init({
    lng: stored && LOADERS[stored] ? stored : FALLBACK,
    fallbackLng: FALLBACK,
    supportedLngs: Object.keys(LOADERS),
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

// O <html lang> acompanha a língua escolhida — é por ele que o browser escolhe
// a hifenização, o corretor e a voz dos leitores de ecrã
document.documentElement.lang = i18n.language;

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng);
  document.documentElement.lang = lng;
});

export default i18n;
