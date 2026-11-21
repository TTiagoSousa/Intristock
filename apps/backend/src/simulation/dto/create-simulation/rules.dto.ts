// As regras gerais: tamanho por sequências, funding, limites, "não operar se", depósitos, prop firm e períodos excluídos
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  SIZING_ACTIONS,
  STREAKS,
  FUNDING_MODES,
  GUARD_EVENTS,
  DURATION_UNITS,
  INCREASE_PERIODS,
} from './constants';

/**
 * Muda o tamanho depois de N perdas (ou ganhos) seguidos: passa a um valor,
 * multiplica-se ou volta ao normal, durante as X entradas seguintes (0 = até
 * outra regra).
 */
export class SizingRuleDto {
  @IsIn(STREAKS)
  after: (typeof STREAKS)[number];

  @IsInt()
  @Min(1)
  @Max(50)
  count: number;

  @IsIn(SIZING_ACTIONS)
  action: (typeof SIZING_ACTIONS)[number];

  @ValidateIf((rule: SizingRuleDto) => rule.action !== 'reset')
  @IsNumber()
  @Min(0.01)
  @Max(1_000_000_000)
  value?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  trades?: number;
}

export class FundingDto {
  @IsIn(FUNDING_MODES)
  mode: (typeof FUNDING_MODES)[number];

  // Em 'fixed': a taxa de cada 8 horas, em % (0,01 = a habitual da Binance)
  @ValidateIf((funding: FundingDto) => funding.mode === 'fixed')
  @IsNumber()
  @Min(-1)
  @Max(1)
  ratePct?: number;
}

export class DailyLimitsDto {
  // Perdas seguidas no dia
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxLosses?: number;

  // % do capital perdida no dia
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxLossPct?: number;
}

export class DurationDto {
  @IsNumber()
  @Min(0.01)
  @Max(10_000)
  count: number;

  @IsIn(DURATION_UNITS)
  unit: (typeof DURATION_UNITS)[number];
}

/**
 * Não operar se: N stops, N perdas, N perdas seguidas, uma perda em valor ou
 * em % dentro da janela (sem janela, desde o início); acontecendo, pausa.
 */
export class TradingGuardDto {
  @IsIn(GUARD_EVENTS)
  event: (typeof GUARD_EVENTS)[number];

  @IsNumber()
  @Min(0.01)
  @Max(1_000_000_000)
  value: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => DurationDto)
  window?: DurationDto | null;

  @ValidateNested()
  @Type(() => DurationDto)
  pause: DurationDto;
}

/** O depósito sobe este valor a cada trimestre ou ano. */
export class DepositIncreaseDto {
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  amount: number;

  @IsIn(INCREASE_PERIODS)
  every: (typeof INCREASE_PERIODS)[number];
}

// O drawdown máximo de um desafio: desde o capital inicial ou desde o máximo
export const MAX_LOSS_MODES = ['static', 'trailing'] as const;

/**
 * As regras de um desafio de prop firm, avaliadas no relatório (não mudam os
 * trades): perda máxima num dia (sobre o capital no início dele), perda máxima
 * total (do inicial, ou do máximo a acompanhar), objetivo de lucro, mínimo de
 * dias com trades e a duração do desafio em dias.
 */
export class PropFirmDto {
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(50)
  dailyLossPct?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(90)
  maxLossPct?: number | null;

  @IsOptional()
  @IsIn(MAX_LOSS_MODES)
  maxLossMode?: (typeof MAX_LOSS_MODES)[number];

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(1000)
  profitTargetPct?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  minTradingDays?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number | null;
}

/** Dias em que não se entra (e em que as posições abertas fecham no início). */
export class ExcludedPeriodDto {
  @IsDateString({ strict: true })
  from: string;

  @IsDateString({ strict: true })
  to: string;
}
