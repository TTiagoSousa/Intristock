import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// O que o utilizador escolheu. 'system' segue a preferência do sistema
// operativo — antes chamava-se 'auto' e olhava para as HORAS do relógio,
// o que fazia o tema mudar sozinho a meio da tarde sem ninguém perceber.
export type ThemePreference = 'light' | 'dark' | 'system';

// O tema que está mesmo aplicado depois de resolver o 'system'
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  preference: ThemePreference;
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'theme';
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const systemTheme = (): ResolvedTheme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const readStoredPreference = (): ThemePreference => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;

  // Migração da chave antiga: 'auto' passa a 'system', o resto mantém-se
  const legacy = localStorage.getItem('mode');
  if (legacy === 'light' || legacy === 'dark') return legacy;
  return 'system';
};

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // Lido logo na inicialização do estado, não num efeito: assim a app nunca
  // pinta um tema para trocar para o outro no primeiro instante
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemPreference, setSystemPreference] = useState<ResolvedTheme>(systemTheme);

  const theme: ResolvedTheme = preference === 'system' ? systemPreference : preference;

  // Enquanto seguir o sistema, acompanha mudanças em tempo real
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystemPreference(event.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  // O atributo vai no <html> e só existe quando há escolha explícita.
  // Sem atributo, é a media query do CSS que decide — é o que faz o modo
  // "sistema" funcionar sem JavaScript nenhum à mistura.
  useEffect(() => {
    const root = document.documentElement;
    if (preference === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', preference);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    localStorage.setItem(STORAGE_KEY, next);
    localStorage.removeItem('mode');
    setPreferenceState(next);
  }, []);

  // O botão alterna a partir do que está à VISTA, não da preferência guardada:
  // quem segue o sistema em escuro e carrega no botão espera ficar em claro
  const toggleTheme = useCallback(() => {
    setPreference(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setPreference]);

  const value = useMemo(
    () => ({ preference, theme, setPreference, toggleTheme }),
    [preference, theme, setPreference, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme tem de ser usado dentro de um ThemeProvider');
  }

  return context;
}
