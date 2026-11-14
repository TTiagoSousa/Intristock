import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../Locales/en/translation.json';
import pt from '../Locales/pt/translation.json';

i18n.use(initReactI18next).init({
  lng: localStorage.getItem('language') || 'pt',
  fallbackLng: 'pt',
  resources: {
    en: { translation: en },
    pt: { translation: pt },
  },
  interpolation: { escapeValue: false },
});

// O <html lang> acompanha a língua escolhida — é por ele que o browser escolhe
// a hifenização, o corretor e a voz dos leitores de ecrã
document.documentElement.lang = i18n.language;

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng);
  document.documentElement.lang = lng;
});

export default i18n;
