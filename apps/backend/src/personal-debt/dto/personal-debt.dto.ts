import { OmitType, PartialType } from '@nestjs/mapped-types';
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
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

// owe: a pessoa deve · lent: devem-lhe (emprestou)
export const DEBT_DIRECTIONS = ['owe', 'lent'] as const;

export const DEBT_KINDS = [
  'mortgage',
  'car',
  'personal',
  'credit_card',
  'student',
  'consumer',
  'family',
  'tax',
  'other',
] as const;

export const DEBT_RATE_TYPES = ['fixed', 'variable'] as const;

// active: a correr · paid_off: paga até ao fim · closed: fechada antes (renegociada, perdoada)
export const DEBT_STATUSES = ['active', 'paid_off', 'closed'] as const;

// installment: uma prestação · extra: amortização antecipada · charge: aumenta a dívida
export const DEBT_MOVEMENT_KINDS = ['installment', 'extra', 'charge'] as const;

// O mês de uma prestação
export const DEBT_PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Uma dívida. Sem `openingBalance` entra com o montante todo por pagar na data
 * de início; uma dívida antiga regista-se com o que falta e a data desse valor.
 */
export class CreatePersonalDebtDto {
  @IsOptional()
  @IsIn(DEBT_DIRECTIONS)
  direction?: string;

  @IsIn(DEBT_KINDS)
  kind: string;

  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  counterparty?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  platformId?: string | null;

  @IsUUID()
  currencyId: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  principal: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingBalance?: number;

  @IsOptional()
  @IsDateString()
  openingDate?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRate?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(DEBT_RATE_TYPES)
  rateType?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  installment?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDay?: number | null;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  bankAccountId?: string | null;

  @IsOptional()
  @IsIn(DEBT_STATUSES)
  status?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class UpdatePersonalDebtDto extends PartialType(CreatePersonalDebtDto) {}

/**
 * Um movimento de uma dívida. Num pagamento, a parte do capital é a que abate o
 * saldo: sem ela, é o valor menos os juros e os encargos (sem estes, tudo).
 */
export class CreateDebtMovementDto {
  @IsUUID()
  debtId: string;

  @IsIn(DEBT_MOVEMENT_KINDS)
  kind: string;

  @IsDateString()
  date: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  principalPart?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  interestPart?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  feesPart?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(DEBT_PERIOD)
  period?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  bankAccountId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

// A dívida e o tipo não mudam
export class UpdateDebtMovementDto extends PartialType(
  OmitType(CreateDebtMovementDto, ['debtId', 'kind'] as const),
) {}
