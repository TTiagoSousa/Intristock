import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

// employer: um empregador (salário) · client: um cliente dos recibos verdes ·
// lottery: raspadinhas e jogos · other: o resto
export const INCOME_SOURCE_KINDS = [
  'employer',
  'client',
  'lottery',
  'other',
] as const;
export type IncomeSourceKind = (typeof INCOME_SOURCE_KINDS)[number];

// 12 = sem subsídios (ou em duodécimos); 14 = com os de férias e de Natal à parte
export const SOURCE_PAYMENTS_PER_YEAR = [12, 14] as const;

/**
 * Uma fonte de ganhos. O salário (`grossAmount`/`netAmount`, `currencyId`,
 * `payDay`, `paymentsPerYear`, `startDate`) é opcional: com ele, cada mês
 * aparece como um ganho esperado.
 */
export class CreateIncomeSourceDto {
  @IsIn(INCOME_SOURCE_KINDS)
  kind: IncomeSourceKind;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  companyId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  grossAmount?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  netAmount?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  currencyId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  payDay?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsIn(SOURCE_PAYMENTS_PER_YEAR)
  paymentsPerYear?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// O tipo não muda
export class UpdateIncomeSourceDto extends PartialType(
  OmitType(CreateIncomeSourceDto, ['kind'] as const),
) {}
