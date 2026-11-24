import { useCallback, useMemo, useState } from 'react';
import type { Data_Column_Type, Data_Filter_Op, Data_Row_Filter } from '../../../../Hooks/Companies/useCompanyData';

// Quantas colunas a tabela mostra até se escolherem outras; a linha toda fica no «Info»
export const DEFAULT_COLUMNS = 5;
export const MAX_FILTERS = 10;

/** Uma coluna da grelha (de uma tabela ou de uma tabela unida). */
export interface Grid_Column {
  key: string;
  label: string;
  type: Data_Column_Type;
  personal: boolean;
  side?: 'left' | 'right';
}

export type Filter_Kind = 'text' | 'number' | 'date';

export const filterKindOf = (type: Data_Column_Type): Filter_Kind =>
  type === 'number' || type === 'money' ? 'number' : type === 'date' ? 'date' : 'text';

// As condições de cada tipo de coluna (o backend recusa maior/menor no texto)
export const OPS_BY_KIND: Record<Filter_Kind, Data_Filter_Op[]> = {
  text: ['in', 'contains', 'equals', 'not', 'empty', 'notEmpty'],
  number: ['equals', 'not', 'gt', 'gte', 'lt', 'lte', 'empty', 'notEmpty'],
  date: ['equals', 'not', 'gt', 'gte', 'lt', 'lte', 'empty', 'notEmpty'],
};

// O texto escrito à mão (o «é um de» escolhe da lista, o vazio não precisa de nada)
export const opNeedsValue = (op: Data_Filter_Op) => op !== 'empty' && op !== 'notEmpty' && op !== 'in';

/** O filtro tem o que precisa: o valor escrito ou, no «é um de», pelo menos um da lista. */
export const filterIsComplete = (filter: Data_Row_Filter) =>
  filter.op === 'in' ? Boolean(filter.values?.length) : !opNeedsValue(filter.op) || Boolean(filter.value?.trim());

interface Stored {
  columns: string[] | null;
  filters: Data_Row_Filter[];
}

const read = (storageKey: string): Stored => {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { columns: null, filters: [] };
    const parsed = JSON.parse(raw) as Partial<Stored>;
    return {
      columns: Array.isArray(parsed.columns) ? parsed.columns.filter((key): key is string => typeof key === 'string') : null,
      filters: Array.isArray(parsed.filters) ? parsed.filters : [],
    };
  } catch {
    return { columns: null, filters: [] };
  }
};

const write = (storageKey: string, value: Stored) => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Sem armazenamento (janela privada): fica só nesta visita
  }
};

export interface Filter_Editor_State {
  anchor: HTMLElement;
  // O filtro que se edita, ou nulo para um novo
  index: number | null;
  column?: string;
}

/**
 * As escolhas de quem vê uma tabela: as colunas que aparecem e os filtros, guardados
 * no browser para cada tabela (`intristock-data-grid.<tipo>.<id>`). Só contam as
 * colunas que existem e que quem vê pode filtrar (as pessoais só com `data.personal`).
 */
export const useDataGrid = (storageKey: string, columns: Grid_Column[], defaultShown: string[], personalVisible: boolean) => {
  const [stored, setStored] = useState<Stored>(() => read(storageKey));
  const [editor, setEditor] = useState<Filter_Editor_State | null>(null);

  const filterable = useMemo(() => columns.filter((column) => personalVisible || !column.personal), [columns, personalVisible]);

  const shownKeys = useMemo(() => {
    const known = new Set(columns.map((column) => column.key));
    const picked = stored.columns?.filter((key) => known.has(key)) ?? [];
    return picked.length ? picked : defaultShown.filter((key) => known.has(key));
  }, [columns, stored.columns, defaultShown]);

  // A ordem é a das colunas da tabela, não a ordem em que se escolheram
  const shown = useMemo(() => {
    const keys = new Set(shownKeys);
    return columns.filter((column) => keys.has(column.key));
  }, [columns, shownKeys]);

  const filters = useMemo(() => {
    // As colunas de uma tabela unida só chegam com as linhas: até lá vão os filtros guardados
    if (columns.length === 0) return stored.filters;
    const byKey = new Map(filterable.map((column) => [column.key, column]));
    return stored.filters.filter((filter) => {
      const column = byKey.get(filter.column);
      return column && OPS_BY_KIND[filterKindOf(column.type)].includes(filter.op) && filterIsComplete(filter);
    });
  }, [columns.length, filterable, stored.filters]);

  const save = useCallback(
    (next: Partial<Stored>) =>
      setStored((current) => {
        const value = { ...current, ...next };
        write(storageKey, value);
        return value;
      }),
    [storageKey],
  );

  return {
    columns,
    filterable,
    shown,
    shownKeys,
    isDefaultColumns: !stored.columns,
    setShownKeys: (keys: string[] | null) => save({ columns: keys && keys.length ? keys : null }),
    filters,
    setFilters: (next: Data_Row_Filter[]) => save({ filters: next.slice(0, MAX_FILTERS) }),
    editor,
    openEditor: (state: Filter_Editor_State) => setEditor(state),
    closeEditor: () => setEditor(null),
  };
};

export type Data_Grid = ReturnType<typeof useDataGrid>;

/**
 * Os filtros de um formulário (as definições de uma secção das Leads): a mesma forma do `useDataGrid`, para usar a
 * mesma barra e o mesmo editor, mas em memória (gravam-se com o formulário). Os filtros são de quem gere a secção,
 * por isso valem em todas as colunas, as pessoais também.
 */
export const useFilterDraft = (columns: Grid_Column[], initial: Data_Row_Filter[]) => {
  const [filters, setFiltersState] = useState<Data_Row_Filter[]>(initial);
  const [editor, setEditor] = useState<Filter_Editor_State | null>(null);
  const grid: Data_Grid = {
    columns,
    filterable: columns,
    shown: columns,
    shownKeys: columns.map((column) => column.key),
    isDefaultColumns: true,
    setShownKeys: () => undefined,
    filters,
    setFilters: (next: Data_Row_Filter[]) => setFiltersState(next.slice(0, MAX_FILTERS)),
    editor,
    openEditor: (state: Filter_Editor_State) => setEditor(state),
    closeEditor: () => setEditor(null),
  };
  return grid;
};
