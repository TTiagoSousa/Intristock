import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

// O que se faz com o dinheiro passivo (uma conta poupança): entra, sai, rende ou paga.
// O valor vai sempre positivo; o tipo diz para que lado conta.
export const CASH_TRANSACTION_KINDS = [
  'deposit',
  'withdrawal',
  'interest',
  'fee',
  'tax',
] as const;

export class PortfolioSummaryQueryDto {
  @IsOptional()
  @IsUUID()
  currencyId?: string;
}

export class CreatePortfolioDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;
}

/** Uma transação de dinheiro passivo: o ativo é o dinheiro da moeda escolhida. */
export class CreateCashTransactionDto {
  @IsIn(CASH_TRANSACTION_KINDS)
  kind: string;

  @IsDateString()
  date: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsUUID()
  currencyId: string;

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
