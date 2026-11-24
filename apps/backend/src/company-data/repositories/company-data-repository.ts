import { CellValue, RowData } from '../helpers/dataTypes';
import { RowFilter } from '../helpers/rowFilters';

/** Uma linha a gravar numa importação (`key` nula numa tabela sem chave). */
export type ImportRow = { key: string | null; data: RowData };

export type UpsertCounts = { created: number; updated: number; unchanged: number };

export type RowsQuery = {
  skip: number;
  take: number;
  search?: string;
  /// As colunas em que a pesquisa procura (sem as pessoais, para quem não as vê)
  searchKeys: string[];
  /// Os filtros por coluna (já validados), todos têm de bater
  filters: RowFilter[];
};

/// Os valores de uma coluna: as linhas da pesquisa e dos filtros, só os que têm `q`
export type ColumnValuesQuery = Omit<RowsQuery, 'skip' | 'take'> & { column: string; q?: string; limit: number };

/// Um valor da coluna (como aparece mais vezes) e quantas linhas o têm; "" = vazio
export type ColumnValueCount = { value: string; count: number };

export type StoredRow = { id: string; key: string | null; data: Record<string, CellValue>; updatedAt: Date };
