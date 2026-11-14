/* eslint-disable react-refresh/only-export-components -- o provider e os hooks dele ficam juntos, como nos outros contextos */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface ActiveRunContextType {
  activeRunId: string | null;
  setActiveRunId: (runId: string | null) => void;
}

const ActiveRunContext = createContext<ActiveRunContextType | undefined>(undefined);

// A simulação aberta que ainda não acabou: enquanto corre, a barra lateral
// esconde as vistas dela (só há a página do progresso)
export function ActiveRunProvider({ children }: { children: ReactNode }) {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  return <ActiveRunContext.Provider value={{ activeRunId, setActiveRunId }}>{children}</ActiveRunContext.Provider>;
}

export function useActiveRun() {
  const context = useContext(ActiveRunContext);

  if (context === undefined) {
    throw new Error('useActiveRun must be used within an ActiveRunProvider');
  }

  return context.activeRunId;
}

// Marca a simulação como a correr enquanto a página estiver montada e ela não acabar
export function useMarkActiveRun(runId: string | undefined, active: boolean) {
  const context = useContext(ActiveRunContext);
  const setActiveRunId = context?.setActiveRunId;

  useEffect(() => {
    if (!setActiveRunId || !runId || !active) return;
    setActiveRunId(runId);
    return () => setActiveRunId(null);
  }, [runId, active, setActiveRunId]);
}
