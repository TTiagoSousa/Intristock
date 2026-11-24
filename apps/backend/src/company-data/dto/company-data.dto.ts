import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { DATA_TABLE_SOURCES } from '../helpers/createDataTable';
import { JOIN_TYPES } from '../helpers/dataTypes';
import { VIEW_FILTERS } from '../helpers/pageJoinedRows';

// As colunas, os pares e as colunas das unidas validam-se nos helpers (assertColumns, assertViewDefinition)

export class CreateDataTableDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsIn(DATA_TABLE_SOURCES)
  source: (typeof DATA_TABLE_SOURCES)[number];

  @IsArray()
  columns: unknown[];

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  keyColumn?: string | null;
}

export class UpdateDataTableDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsArray()
  columns?: unknown[];

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  keyColumn?: string | null;
}

export class DataRowsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  take: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  /// JSON: [{ column, op, value }] (ver `rowFilters.ts`)
  @IsOptional()
  @IsString()
  @MaxLength(12000)
  filters?: string;
}

export class DataViewRowsQueryDto extends DataRowsQueryDto {
  @IsOptional()
  @IsIn(VIEW_FILTERS)
  only?: (typeof VIEW_FILTERS)[number];
}

/** Os valores de uma coluna (para o «é um de»), nas linhas da pesquisa e dos outros filtros. */
export class DataColumnValuesQueryDto {
  @IsString()
  @MaxLength(80)
  column: string;

  /// Só os valores que têm este texto
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  filters?: string;
}

export class DataViewColumnValuesQueryDto extends DataColumnValuesQueryDto {
  @IsOptional()
  @IsIn(VIEW_FILTERS)
  only?: (typeof VIEW_FILTERS)[number];
}

export class SaveDataRowDto {
  @IsObject()
  data: Record<string, unknown>;
}

/** Os campos de texto do multipart de uma importação. */
export class ImportDataFileDto {
  /// JSON: { "<cabeçalho do ficheiro>": "<key da coluna>" }
  @IsString()
  @MaxLength(20_000)
  mapping: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  skipTotals?: 'true' | 'false';
}

export class DataViewDefinitionDto {
  @IsUUID()
  leftTableId: string;

  @IsUUID()
  rightTableId: string;

  @IsArray()
  joinOn: unknown[];

  @IsIn(JOIN_TYPES)
  joinType: (typeof JOIN_TYPES)[number];

  @IsArray()
  columns: unknown[];
}

export class CreateDataViewDto extends DataViewDefinitionDto {
  @IsString()
  @MaxLength(120)
  name: string;
}

export class UpdateDataViewDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUUID()
  leftTableId?: string;

  @IsOptional()
  @IsUUID()
  rightTableId?: string;

  @IsOptional()
  @IsArray()
  joinOn?: unknown[];

  @IsOptional()
  @IsIn(JOIN_TYPES)
  joinType?: (typeof JOIN_TYPES)[number];

  @IsOptional()
  @IsArray()
  columns?: unknown[];
}
