import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export const MEMBER_PAY_KINDS = ['salary', 'freelance'] as const;
export type MemberPayKind = (typeof MEMBER_PAY_KINDS)[number];

// 12 = sem subsídios (ou em duodécimos); 14 = com os de férias e de Natal à parte
export const PAYMENTS_PER_YEAR = [12, 14] as const;

/**
 * Um salário (`salary`: bruto por mês, quantas vezes por ano, o dia e desde
 * quando) ou um recibo verde (`freelance`: o valor, a data e a retenção).
 * Os campos do outro tipo ignoram-se.
 */
export class CreateMemberPayDto {
  @IsIn(MEMBER_PAY_KINDS)
  kind: MemberPayKind;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  contractId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  description?: string | null;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  grossAmount: number;

  @IsOptional()
  @Type(() => Number)
  @IsIn(PAYMENTS_PER_YEAR)
  paymentsPerYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  payDay?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  withholdingPct?: number | null;

  // Mudar o salário: o que este substitui (fecha na véspera do início deste quando contar)
  @IsOptional()
  @IsUUID()
  replacesId?: string;
}

// O tipo não muda: um salário não passa a recibo verde
export class UpdateMemberPayDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  contractId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  description?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  grossAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsIn(PAYMENTS_PER_YEAR)
  paymentsPerYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  payDay?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  withholdingPct?: number | null;
}
