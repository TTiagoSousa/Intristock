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

// De onde vem (compra) ou para onde vai (venda) o dinheiro de uma compra à mão:
// new = dinheiro novo (entra / sai da carteira); portfolio = o saldo de um portefólio
export const POSITION_CASH_MODES = ['new', 'portfolio'] as const;

/**
 * Uma compra ou venda à mão: o mercado (uma ação do Yahoo pelo símbolo, ou um par da
 * Binance ou da Coinbase pelo id), a quantidade, o preço por unidade, a comissão e de
 * onde vem o dinheiro.
 */
export class CreatePositionTransactionDto {
  @IsIn(['buy', 'sell'])
  kind: 'buy' | 'sell';

  @IsDateString()
  date: string;

  // A hora (o instante em ISO, já em UTC): opcional; sem ela fica só o dia
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  at?: string | null;

  // Um destes dois
  @ValidateIf((dto: CreatePositionTransactionDto) => !dto.instrumentId)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  yahooSymbol?: string;

  @ValidateIf((dto: CreatePositionTransactionDto) => !dto.yahooSymbol)
  @IsUUID()
  instrumentId?: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity: number;

  // Por unidade, na moeda da transação
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  price: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fee?: number;

  @IsUUID()
  currencyId: string;

  @IsIn(POSITION_CASH_MODES)
  cash: (typeof POSITION_CASH_MODES)[number];

  // Com `cash` portfolio: o portefólio do dinheiro (sem ele, o próprio)
  @IsOptional()
  @IsUUID()
  cashPortfolioId?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

/** A pesquisa de um mercado para uma compra à mão: ações no Yahoo, cripto numa corretora. */
export class MarketSearchQueryDto {
  @IsIn(['stock', 'crypto'])
  kind: 'stock' | 'crypto';

  // Na cripto: binance · coinbase
  @ValidateIf((dto: MarketSearchQueryDto) => dto.kind === 'crypto')
  @IsIn(['binance', 'coinbase'])
  source?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  q: string;
}

/** O preço de um mercado num dia (para propor no formulário). */
export class MarketPriceQueryDto {
  @ValidateIf((dto: MarketPriceQueryDto) => !dto.instrumentId)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  yahooSymbol?: string;

  @ValidateIf((dto: MarketPriceQueryDto) => !dto.yahooSymbol)
  @IsUUID()
  instrumentId?: string;

  @IsDateString()
  date: string;
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

/** De quantas em quantas horas uma ligação sincroniza sozinha: hora a hora, por dia, por semana. */
export const SYNC_INTERVAL_HOURS = [1, 24, 168] as const;

/** Mudar uma ligação: a chave (as duas juntas), o dia a partir do qual se vê, a pausa, o intervalo. */
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

  @IsOptional()
  @IsIn(SYNC_INTERVAL_HOURS)
  syncEveryHours?: number;
}

/** Uma transação de dinheiro passivo: o ativo é o dinheiro da moeda escolhida. */
export class CreateCashTransactionDto {
  @IsIn(CASH_TRANSACTION_KINDS)
  kind: string;

  @IsDateString()
  date: string;

  // A hora (o instante em ISO, já em UTC): opcional; sem ela fica só o dia
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  at?: string | null;

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
