import { PartialType } from '@nestjs/mapped-types';
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
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const SUBSCRIPTION_KINDS = [
  'video',
  'music',
  'gaming',
  'software',
  'news',
  'other',
] as const;
export const SUBSCRIPTION_STATUSES = ['active', 'paused', 'cancelled'] as const;
// Os meses à frente que a lista dos pagamentos mostra, no máximo
export const MAX_SUBSCRIPTION_MONTHS = 36;

/**
 * Uma subscrição: recorrente (renova-se de `intervalMonths` em `intervalMonths`
 * meses no `billingDay`, até ao `endDate` ou sem fim) ou não (um só pagamento,
 * que cobre de `startDate` a `endDate`).
 */
export class CreateSubscriptionDto {
  @IsIn(SUBSCRIPTION_KINDS)
  kind: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  merchant?: string | null;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsUUID()
  currencyId: string;

  @IsBoolean()
  recurring: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  intervalMonths?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  billingDay?: number | null;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUSES)
  status?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  bankAccountId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  notes?: string | null;
}

export class UpdateSubscriptionDto extends PartialType(CreateSubscriptionDto) {}

export class SubscriptionPeriodsQueryDto {
  // Os meses à frente (para trás são sempre os 3 em atraso)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SUBSCRIPTION_MONTHS)
  months?: number;

  // A moeda do total por mês (as outras pelo `Currency.rate`)
  @IsOptional()
  @IsUUID()
  currencyId?: string;
}

// Marcar um período como pago: grava a despesa (por omissão, o valor e o dia dele)
export class PaySubscriptionDto {
  @Matches(/^(\d{4}-(0[1-9]|1[0-2])|once)$/)
  period: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  bankAccountId?: string | null;
}
