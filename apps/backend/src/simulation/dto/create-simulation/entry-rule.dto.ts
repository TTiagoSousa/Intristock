// Uma entrada da estratégia
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  SIDES,
  MAX_NAME,
  MAX_POSITIONS,
  MAX_LEVERAGE,
  MAX_LOOKBACK,
} from './constants';
import {
  CONDITION_MATCHES,
  ConditionDto,
} from './condition.dto';
import {
  ExitPriceDto,
} from './exit-price.dto';
import {
  STOP_MODES,
  MAX_PARTIALS,
  PartialExitDto,
  MAX_STOP_RULES,
  MAX_SCALE_INS,
  MAX_CONTEXT_RULES,
  SetupDto,
  StopRuleDto,
  ScaleInDto,
  ContextRuleDto,
} from './entry-parts.dto';
import {
  SizingDto,
  ScheduleDto,
} from './sizing-schedule.dto';
import {
  ExitRuleDto,
} from './exit-rule.dto';

/**
 * Uma entrada da estratégia: a direção, as condições (todas têm de se
 * cumprir), o preço a que entra (sem preço, ao mercado) e as suas saídas:
 * stop, take profit e saídas com condição (basta uma, ganha a que acontecer
 * primeiro).
 */
export class EntryRuleDto {
  // Um nome para os resumos ("entrou por X, saiu por Y"); sem nome, o número
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  name?: string | null;

  @IsIn(SIDES)
  side: (typeof SIDES)[number];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions: ConditionDto[];

  // Todas (por omissão) ou qualquer uma
  @IsOptional()
  @IsIn(CONDITION_MATCHES)
  match?: (typeof CONDITION_MATCHES)[number];

  // Primeiro a preparação, depois as condições
  @IsOptional()
  @ValidateNested()
  @Type(() => SetupDto)
  setup?: SetupDto | null;

  // Só entra se (a conta: o último trade, as séries, as posições…)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CONTEXT_RULES)
  @ValidateNested({ each: true })
  @Type(() => ContextRuleDto)
  context?: ContextRuleDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ExitPriceDto)
  price?: ExitPriceDto;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(99)
  stopLossPct?: number | null;

  // Sem modo, a % (stopLossPct)
  @IsOptional()
  @IsIn(STOP_MODES)
  stopLossMode?: (typeof STOP_MODES)[number];

  @ValidateIf((entry: EntryRuleDto) => entry.stopLossMode === 'swing')
  @IsInt()
  @Min(1)
  @Max(MAX_LOOKBACK)
  stopLossBars?: number | null;

  @ValidateIf((entry: EntryRuleDto) => entry.stopLossMode === 'level')
  @ValidateNested()
  @Type(() => ExitPriceDto)
  stopLossLevel?: ExitPriceDto | null;

  // Na mínima, máxima ou nível: o stop fica esta % para lá dele
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  stopLossBufferPct?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  stopLossName?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1000)
  takeProfitPct?: number | null;

  // O take profit num múltiplo do risco (2 = duas vezes a distância ao stop)
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(50)
  takeProfitR?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PARTIALS)
  @ValidateNested({ each: true })
  @Type(() => PartialExitDto)
  partialExits?: PartialExitDto[];

  // O stop a mexer-se por regras (só aperta)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_STOP_RULES)
  @ValidateNested({ each: true })
  @Type(() => StopRuleDto)
  stopRules?: StopRuleDto[];

  // Juntar à posição aberta
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SCALE_INS)
  @ValidateNested({ each: true })
  @Type(() => ScaleInDto)
  scaleIns?: ScaleInDto[];

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  takeProfitName?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ExitRuleDto)
  exits?: ExitRuleDto[];

  // Num preço a um nível: quantas velas a ordem fica à espera (1 = só a do sinal)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_LOOKBACK)
  orderBars?: number;

  // O nível acompanha o de cada vela (senão fica o do sinal)
  @IsOptional()
  @IsBoolean()
  orderTrack?: boolean;

  // A ordem cai se a condição deixar de se cumprir
  @IsOptional()
  @IsBoolean()
  orderCancel?: boolean;

  // Pirâmide: quantas posições desta entrada ao mesmo tempo
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_POSITIONS)
  maxPositions?: number;

  // O tamanho e a alavancagem desta entrada (sem eles, os gerais)
  @IsOptional()
  @ValidateNested()
  @Type(() => SizingDto)
  sizing?: SizingDto;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(MAX_LEVERAGE)
  leverage?: number;

  // Dias e horas em que entra (only) ou não entra (except)
  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleDto)
  schedule?: ScheduleDto;

  // Quando valem o stop e o take profit
  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleDto)
  stopLossSchedule?: ScheduleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleDto)
  takeProfitSchedule?: ScheduleDto;

  // O stop acompanha o melhor preço desde a entrada, a esta %
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(99)
  trailingStopPct?: number | null;

  // Depois de andar esta % a favor, o stop passa ao preço de entrada
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1000)
  breakEvenPct?: number | null;

  // Sai ao mercado ao fim de N velas
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  maxBars?: number | null;
}
