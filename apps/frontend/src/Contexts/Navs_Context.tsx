import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type NavigationType = 'Sidebar_Home' | 'Mobile_Menu';

const MOBILE_BREAKPOINT = 1000;
// O painel das secções recolhido fica lembrado neste browser
const PANEL_COLLAPSED_KEY = 'intristock-panel-collapsed';

interface NavigationContextType {
  typeOfNavigation: NavigationType;
  setTypeOfNavigation: (type: NavigationType) => void;
  effectiveNavigation: NavigationType;
  isMobileViewport: boolean;
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  isPanelCollapsed: boolean;
  togglePanel: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [typeOfNavigation, setTypeOfNavigationState] = useState<NavigationType>(() => {
    const saved = localStorage.getItem('sidebarPosition');
    return (saved as NavigationType) || 'Sidebar_Home';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(() => {
    try {
      return localStorage.getItem(PANEL_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);

  useEffect(() => {
    localStorage.setItem('sidebarPosition', typeOfNavigation);
  }, [typeOfNavigation]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < MOBILE_BREAKPOINT);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const setTypeOfNavigation = (type: NavigationType) => {
    setTypeOfNavigationState(type);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const togglePanel = () => {
    setIsPanelCollapsed((prev) => {
      try {
        localStorage.setItem(PANEL_COLLAPSED_KEY, prev ? '0' : '1');
      } catch {
        // Sem armazenamento fica só nesta sessão
      }
      return !prev;
    });
  };

  const effectiveNavigation: NavigationType = isMobileViewport ? 'Mobile_Menu' : typeOfNavigation;

  return (
    <NavigationContext.Provider
      value={{
        typeOfNavigation,
        setTypeOfNavigation,
        effectiveNavigation,
        isMobileViewport,
        isMobileMenuOpen,
        toggleMobileMenu,
        isPanelCollapsed,
        togglePanel,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavs() {
  const context = useContext(NavigationContext);

  if (context === undefined) {
    throw new Error('useNavs must be used within a NavigationProvider');
  }

  return context;
}
