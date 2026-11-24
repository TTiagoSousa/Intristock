/** As formas das tabelas de dados (o que fica nos JSON da `CompanyDataTable` e da `CompanyDataView`). */

export const DATA_COLUMN_TYPES = ['text', 'number', 'date', 'money', 'phone', 'email'] as const;
export type DataColumnType = (typeof DATA_COLUMN_TYPES)[number];

export interface DataColumn {
  /// [a-z0-9_], único na tabela e fixo: é a chave no `CompanyDataRow.data`
  key: string;
  label: string;
  type: DataColumnType;
  /// Nome, morada, email, telefone…: só quem tem `data.personal` o vê sem •••
  personal: boolean;
  hidden: boolean;
  /// O cabeçalho do ficheiro de onde veio (para a próxima importação reconhecer)
  sourceHeader?: string | null;
}

export const JOIN_NORMALIZE = ['trim', 'lower', 'digits', 'firstToken'] as const;
export type JoinNormalize = (typeof JOIN_NORMALIZE)[number];

export interface JoinPair {
  left: string;
  right: string;
  normalize: JoinNormalize[];
}

export const JOIN_TYPES = ['inner', 'left', 'full'] as const;
export type JoinType = (typeof JOIN_TYPES)[number];

export interface ViewColumn {
  side: 'left' | 'right';
  column: string;
  label: string;
}

export interface ImportConfig {
  mapping: Record<string, string>;
  skipTotals: boolean;
}

export type CellValue = string | number | null;
export type RowData = Record<string, CellValue>;

/// O que se mostra no lugar de um dado pessoal a quem não tem `data.personal`
export const MASK = '•••';

// Limites: um ficheiro grande corre na mesma, mas não sem fim
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 50_000;
export const MAX_TABLE_ROWS = 100_000;
export const MAX_COLUMNS = 80;
export const MAX_JOIN_PAIRS = 3;
export const MAX_VIEW_COLUMNS = 60;
