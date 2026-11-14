import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const INCOME_KINDS = [
  'salary',
  'freelance',
  'lottery',
  'other',
] as const;
export type IncomeKind = (typeof INCOME_KINDS)[number];

// received: já entrou · pending: ainda por receber
export const INCOME_STATUSES = ['received', 'pending'] as const;

// O que se recebe de um salário: `YYYY-MM`, `YYYY-MM:holiday`, `YYYY-MM:christmas` ou `once`
export const INCOME_PERIOD =
  /^(\d{4}-(0[1-9]|1[0-2])(:holiday|:christmas)?|once)$/;

/**
 * Um ganho. Solto (só o tipo e, se se quiser, a fonte), ou de um salário
 * esperado: de uma fonte (`sourceId` + `period`) ou de uma empresa da base
 * (`memberPayId` + `period`) — o tipo vem dele.
 */
export class CreatePersonalIncomeDto {
  @IsOptional()
  @IsIn(INCOME_KINDS)
  kind?: IncomeKind;

  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @IsOptional()
  @IsUUID()
  memberPayId?: string;

  @IsOptional()
  @Matches(INCOME_PERIOD)
  period?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  description?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  grossAmount?: number | null;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  withholdingPct?: number | null;

  @IsUUID()
  currencyId: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsIn(INCOME_STATUSES)
  status?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  bankAccountId?: string | null;
}

// A origem (tipo, fonte, salário e período) não muda
export class UpdatePersonalIncomeDto extends PartialType(
  OmitType(CreatePersonalIncomeDto, [
    'kind',
    'sourceId',
    'memberPayId',
    'period',
  ] as const),
) {}
