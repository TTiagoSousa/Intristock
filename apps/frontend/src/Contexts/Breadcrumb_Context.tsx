import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

interface BreadcrumbContextType {
  labels: Record<string, string>;
  setSegmentLabel: (segment: string, label: string) => void;
  clearSegmentLabel: (segment: string) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<Record<string, string>>({});

  const setSegmentLabel = useCallback((segment: string, label: string) => {
    setLabels((current) => (current[segment] === label ? current : { ...current, [segment]: label }));
  }, []);

  const clearSegmentLabel = useCallback((segment: string) => {
    setLabels((current) => {
      if (!(segment in current)) return current;

      const { [segment]: _removed, ...rest } = current;
      return rest;
    });
  }, []);

  return (
    <BreadcrumbContext.Provider value={{ labels, setSegmentLabel, clearSegmentLabel }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb() {
  const context = useContext(BreadcrumbContext);

  if (context === undefined) {
    throw new Error('useBreadcrumb must be used within a BreadcrumbProvider');
  }

  return context;
}

// Regista um nome legível para um segmento dinâmico do URL (ex. um id) enquanto
// a página estiver montada — o breadcrumb mostra o nome em vez do id.
export function useBreadcrumbSegmentLabel(segment: string | undefined, label: string | undefined) {
  const { setSegmentLabel, clearSegmentLabel } = useBreadcrumb();

  useEffect(() => {
    if (!segment || !label) return;

    setSegmentLabel(segment, label);

    return () => clearSegmentLabel(segment);
  }, [segment, label, setSegmentLabel, clearSegmentLabel]);
}
