import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  Max,
  Min,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { SUMMARY_RANGES, type SummaryRange } from '../helpers/summarizePortfolios';

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

  // O período do gráfico (sem ele, desde a primeira transação)
  @IsOptional()
  @IsIn(SUMMARY_RANGES)
  range?: SummaryRange;
}

/** A moeda da distribuição (sem ela, o euro). */
export class PortfolioAllocationQueryDto {
  @IsOptional()
  @IsUUID()
  currencyId?: string;
}

/** Os filtros da lista de todas as transações (todos opcionais). */
export class PortfolioTransactionsQueryDto {
  @IsOptional()
  @IsUUID()
  portfolioId?: string;

  // manual · api
  @IsOptional()
  @IsIn(['manual', 'api'])
  source?: string;

  @IsOptional()
  @IsUUID()
  platformId?: string;

  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  kind?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  // A moeda do total (sem ela, a das transações mais usada)
  @IsOptional()
  @IsUUID()
  currencyId?: string;

  // A página (a partir de 1) e quantas por página
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}

export class CreatePortfolioDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;
}

/** Ligar uma conta da Trading 212: a chave e o segredo da API e, opcional, de quando se vê. */
export class ConnectBrokerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  apiKey: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  apiSecret: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  fromDate?: string | null;
}

/** Mudar uma ligação: a chave (as duas juntas), o dia a partir do qual se vê, a pausa. */
export class UpdateBrokerConnectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  apiSecret?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  fromDate?: string | null;

  @IsOptional()
  @IsBoolean()
  paused?: boolean;
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
