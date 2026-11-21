// As partes de uma entrada: saídas parciais, preparação, ajustes do stop, reforços e condições da conta
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
  MAX_NAME,
  MAX_LOOKBACK,
} from './constants';
import {
  CONDITION_MATCHES,
  ConditionDto,
} from './condition.dto';
import {
  ExitPriceDto,
} from './exit-price.dto';

// O stop: a % do preço de entrada, a mínima (numa compra) ou a máxima (numa venda)
// das últimas N velas fechadas, ou um nível (o preço de uma vela, uma média, um valor)
export const STOP_MODES = ['pct', 'swing', 'level'] as const;
export const MAX_PARTIALS = 3;

/**
 * Uma saída parcial: fecha esta % da quantidade inicial quando o preço anda a
 * favor uma % ou um múltiplo do risco (R, a distância ao stop). Pode passar o
 * stop para o preço de entrada. O resto segue com as outras saídas.
 */
export class PartialExitDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  name?: string | null;

  @IsNumber()
  @Min(1)
  @Max(99)
  closePct: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1000)
  pct?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(50)
  r?: number | null;

  @IsOptional()
  @IsBoolean()
  moveStop?: boolean;
}

// Ajustes do stop, reforços e condições da conta (até quantos de cada)
export const MAX_STOP_RULES = 5;
export const MAX_SCALE_INS = 3;
export const MAX_CONTEXT_RULES = 5;
export const STOP_RULE_TRIGGERS = ['always', 'profit', 'conditions'] as const;
export const STOP_RULE_TARGETS = ['entry', 'swing', 'level', 'trail'] as const;
export const SCALE_IN_TRIGGERS = ['profit', 'conditions'] as const;
export const CONTEXT_KINDS = [
  'lastTrade',
  'winStreak',
  'lossStreak',
  'openPositions',
  'tradesToday',
  'dayPnlPct',
  'drawdownPct',
] as const;
export const CONTEXT_SCOPES = ['all', 'self'] as const;
export const CONTEXT_OPERATORS = ['gt', 'gte', 'lt', 'lte', 'eq'] as const;
export const TRADE_RESULTS = ['win', 'loss'] as const;

/**
 * A preparação de uma entrada: primeiro estas condições (ficam armadas `bars`
 * velas), depois as da entrada. Pode cair antes, se as de cancelar se cumprirem.
 */
export class SetupDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions: ConditionDto[];

  @IsOptional()
  @IsIn(CONDITION_MATCHES)
  match?: (typeof CONDITION_MATCHES)[number];

  @IsInt()
  @Min(1)
  @Max(MAX_LOOKBACK)
  bars: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  cancel?: ConditionDto[] | null;

  @IsOptional()
  @IsIn(CONDITION_MATCHES)
  cancelMatch?: (typeof CONDITION_MATCHES)[number];
}

/**
 * Um ajuste do stop: a partir de quando acontece (sempre, depois de X R ou X % a
 * favor, ou quando as condições se cumprem), o stop passa para a entrada, para a
 * mínima/máxima das últimas N velas, para um nível ou para um trailing em %. O
 * stop só aperta.
 */
export class StopRuleDto {
  @IsIn(STOP_RULE_TRIGGERS)
  trigger: (typeof STOP_RULE_TRIGGERS)[number];

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(50)
  r?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1000)
  pct?: number | null;

  @ValidateIf((rule: StopRuleDto) => rule.trigger === 'conditions')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions?: ConditionDto[];

  @IsOptional()
  @IsIn(CONDITION_MATCHES)
  match?: (typeof CONDITION_MATCHES)[number];

  @IsIn(STOP_RULE_TARGETS)
  to: (typeof STOP_RULE_TARGETS)[number];

  @ValidateIf((rule: StopRuleDto) => rule.to === 'swing')
  @IsInt()
  @Min(1)
  @Max(MAX_LOOKBACK)
  bars?: number;

  @ValidateIf((rule: StopRuleDto) => rule.to === 'level')
  @ValidateNested()
  @Type(() => ExitPriceDto)
  level?: ExitPriceDto;

  @ValidateIf((rule: StopRuleDto) => rule.to === 'trail')
  @IsNumber()
  @Min(0.01)
  @Max(99)
  trailPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  bufferPct?: number | null;
}

/**
 * Um reforço: junta esta % da quantidade inicial quando o preço anda X R ou X %
 * a favor, ou na primeira vela depois da entrada em que as condições se cumprem.
 * Pode passar o stop para o preço de entrada.
 */
export class ScaleInDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  name?: string | null;

  @IsIn(SCALE_IN_TRIGGERS)
  trigger: (typeof SCALE_IN_TRIGGERS)[number];

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(50)
  r?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1000)
  pct?: number | null;

  @ValidateIf((add: ScaleInDto) => add.trigger === 'conditions')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions?: ConditionDto[];

  @IsOptional()
  @IsIn(CONDITION_MATCHES)
  match?: (typeof CONDITION_MATCHES)[number];

  @IsNumber()
  @Min(1)
  @Max(500)
  sizePct: number;

  @IsOptional()
  @IsBoolean()
  moveStop?: boolean;
}

/**
 * Uma condição da conta ("só entra se"): o último trade foi um ganho ou uma
 * perda, as séries, as posições abertas e os trades de hoje (de todas as
 * entradas ou só desta), o P&L de hoje e a distância ao máximo do capital, em %.
 */
export class ContextRuleDto {
  @IsIn(CONTEXT_KINDS)
  kind: (typeof CONTEXT_KINDS)[number];

  @IsOptional()
  @IsIn(CONTEXT_SCOPES)
  scope?: (typeof CONTEXT_SCOPES)[number];

  @ValidateIf((rule: ContextRuleDto) => rule.kind === 'lastTrade')
  @IsIn(TRADE_RESULTS)
  result?: (typeof TRADE_RESULTS)[number];

  @ValidateIf((rule: ContextRuleDto) => rule.kind !== 'lastTrade')
  @IsIn(CONTEXT_OPERATORS)
  operator?: (typeof CONTEXT_OPERATORS)[number];

  @ValidateIf((rule: ContextRuleDto) => rule.kind !== 'lastTrade')
  @IsNumber()
  @Min(-1000)
  @Max(1000)
  value?: number;
}
