// O pedido de uma simulação
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  TIMEFRAMES,
  Timeframe,
  MAX_INDICATORS,
  FEE_MODES,
  DEPOSIT_PERIODS,
  EXECUTION_PRICES,
  MARGIN_MODES,
  OPPOSITE_MODES,
  COOLDOWN_AFTER,
  MAX_POSITIONS,
  MAX_LEVERAGE,
} from './constants';
import {
  IndicatorDto,
} from './indicator.dto';
import {
  SizingDto,
  BlockedTimeDto,
} from './sizing-schedule.dto';
import {
  EntryRuleDto,
} from './entry-rule.dto';
import {
  SizingRuleDto,
  FundingDto,
  DailyLimitsDto,
  TradingGuardDto,
  DepositIncreaseDto,
  PropFirmDto,
  ExcludedPeriodDto,
} from './rules.dto';

// Datas em 'YYYY-MM-DD'; o fim conta o dia inteiro. Percentagens em %, não em
// fração (stop de 2 = 2%)
export class CreateSimulationDto {
  @IsUUID()
  instrumentId: string;

  @IsIn(TIMEFRAMES)
  timeframe: Timeframe;

  @IsDateString({ strict: true })
  from: string;

  @IsDateString({ strict: true })
  to: string;

  @IsNumber()
  @Min(1)
  @Max(1_000_000_000)
  initialCapital: number;

  @IsNumber()
  @Min(0)
  @Max(5)
  feePct: number;

  // Quando se paga a comissão: nos dois lados (por omissão), só à entrada, só à
  // saída ou com uma % diferente em cada. O motor só lê as duas %
  @IsOptional()
  @IsIn(FEE_MODES)
  feeMode?: (typeof FEE_MODES)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  feeEntryPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  feeExitPct?: number;

  // % de preço pior nas ordens a mercado, no stop e nos rompimentos
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  slippagePct?: number;

  // Juros compostos (por omissão): cada trade com o capital todo. Sem eles,
  // sempre com o valor inicial
  @IsOptional()
  @IsBoolean()
  compounding?: boolean;

  // Um valor somado ao capital no início de cada mês, trimestre ou ano
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  depositAmount?: number;

  @IsOptional()
  @IsIn(DEPOSIT_PERIODS)
  depositEvery?: (typeof DEPOSIT_PERIODS)[number] | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => DepositIncreaseDto)
  depositIncrease?: DepositIncreaseDto | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => TradingGuardDto)
  tradingGuards?: TradingGuardDto[];

  @IsOptional()
  @IsIn(EXECUTION_PRICES)
  executionPrice?: (typeof EXECUTION_PRICES)[number];

  @IsOptional()
  @ValidateNested()
  @Type(() => SizingDto)
  sizing?: SizingDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => SizingRuleDto)
  sizingRules?: SizingRuleDto[];

  // Só nos futuros: o tamanho sobre a margem e, com ele, a liquidação
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(MAX_LEVERAGE)
  leverage?: number;

  @IsOptional()
  @IsIn(MARGIN_MODES)
  marginMode?: (typeof MARGIN_MODES)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  maintenanceMarginPct?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => FundingDto)
  funding?: FundingDto;

  // O passo e os mínimos de cada ordem (da corretora); 0 = sem limite
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityStep?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minNotional?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_POSITIONS)
  maxPositions?: number;

  @IsOptional()
  @IsIn(OPPOSITE_MODES)
  opposite?: (typeof OPPOSITE_MODES)[number];

  // Velas sem entrar depois de uma saída (ou só depois de uma perda)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  cooldownBars?: number;

  @IsOptional()
  @IsIn(COOLDOWN_AFTER)
  cooldownAfter?: (typeof COOLDOWN_AFTER)[number];

  @IsOptional()
  @ValidateNested()
  @Type(() => DailyLimitsDto)
  dailyLimits?: DailyLimitsDto;

  // O fuso das horas bloqueadas, dos períodos excluídos e dos dias (IANA)
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => BlockedTimeDto)
  blockedTimes?: BlockedTimeDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ExcludedPeriodDto)
  excludedPeriods?: ExcludedPeriodDto[];

  // Os trades depois desta % do período resumem-se à parte (fora da amostra)
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(90)
  outOfSamplePct?: number | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => PropFirmDto)
  propFirm?: PropFirmDto | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_INDICATORS)
  @ValidateNested({ each: true })
  @Type(() => IndicatorDto)
  indicators?: IndicatorDto[];

  // Na mesma vela, as entradas veem-se pela ordem da lista
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => EntryRuleDto)
  entries: EntryRuleDto[];
}
