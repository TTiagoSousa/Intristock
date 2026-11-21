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
import {
  COMPANY_ITEM_KINDS,
  COMPANY_ITEM_TYPES,
  CompanyItemKind,
  CompanyItemType,
  ITEM_UNITS,
  ItemUnit,
  RECURRENCE_PERIODS,
  RecurrencePeriod,
  STOCK_UNITS,
  StockUnit,
} from './create-company-item.dto';

// Tudo opcional: só se atualiza o que vier no body
export class UpdateCompanyItemDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsIn(COMPANY_ITEM_TYPES)
  type?: CompanyItemType;

  @IsOptional()
  @IsIn(COMPANY_ITEM_KINDS)
  kind?: CompanyItemKind;

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

  @IsOptional()
  @IsIn(ITEM_UNITS)
  unit?: ItemUnit;

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
