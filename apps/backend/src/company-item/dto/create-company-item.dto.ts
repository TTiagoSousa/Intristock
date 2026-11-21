import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export const COMPANY_ITEM_TYPES = ['product', 'service'] as const;
export type CompanyItemType = (typeof COMPANY_ITEM_TYPES)[number];

// O que acontece quando compras um item destes:
//   expense — consome-se de imediato (avença, eletricidade). Não deixa rasto.
//   stock   — passa a ter quantidade em mão (filamento). Gera movimentos.
//   asset   — é imobilizado (a impressora). Gera um registo de ativo.
export const COMPANY_ITEM_KINDS = ['expense', 'stock', 'asset'] as const;
export type CompanyItemKind = (typeof COMPANY_ITEM_KINDS)[number];

// Unidades em que o stock se conta. Diferente de ITEM_UNITS, que é a unidade
// em que se COMPRA: compras bobines (pack) e contas gramas (g).
export const STOCK_UNITS = ['unit', 'g', 'kg', 'ml', 'litre', 'metre'] as const;
export type StockUnit = (typeof STOCK_UNITS)[number];

export const RECURRENCE_PERIODS = ['monthly', 'yearly'] as const;
export type RecurrencePeriod = (typeof RECURRENCE_PERIODS)[number];

// Lista fechada: em texto livre, "mês"/"Mês"/"meses" seriam valores distintos
// e nunca se conseguiria agrupar nada por unidade.
export const ITEM_UNITS = [
  'unit',
  'hour',
  'day',
  'month',
  'year',
  'kg',
  'litre',
  'metre',
  'pack',
  'box',
] as const;
export type ItemUnit = (typeof ITEM_UNITS)[number];

// O companyId vem do parâmetro da rota (`/company/:companyId/items`)
export class CreateCompanyItemDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsIn(COMPANY_ITEM_TYPES)
  type: CompanyItemType;

  @IsOptional()
  @IsIn(COMPANY_ITEM_KINDS)
  kind?: CompanyItemKind;

  // Só para `kind: stock`. Uma bobine de 1 kg é stockUnit "g" com
  // stockPerUnit 1000: compras 4 unidades, entram 4000 g.
  @IsOptional()
  @IsIn(STOCK_UNITS)
  stockUnit?: StockUnit;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  stockPerUnit?: number;

  @IsOptional()
  @IsString()
  description?: string;

  // Unidade em que se compra, de uma lista fechada
  @IsOptional()
  @IsIn(ITEM_UNITS)
  unit?: ItemUnit;

  // Só faz sentido em itens recorrentes: é o valor da subscrição por período.
  // Num produto o preço real é sempre o da compra, e um valor de catálogo
  // desatualizado seria enganador.
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultPrice?: number;

  // Os fornecedores que vendem o item — a lista inteira, substitui a que estava
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  supplierIds?: string[];

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsIn(RECURRENCE_PERIODS)
  recurrencePeriod?: RecurrencePeriod;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
