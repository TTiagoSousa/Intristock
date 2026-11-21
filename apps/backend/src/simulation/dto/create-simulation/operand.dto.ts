// Os valores das condições e dos preços
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  TIMEFRAMES,
  Timeframe,
  MAX_NAME,
  PRICE_FIELDS,
  SESSION_LEVELS,
  isRangeLevel,
  PROFILE_SESSIONS,
  PROFILE_EXCHANGES,
  PROFILE_ROWS_LAYOUTS,
  PROFILE_LEVELS,
  PROFILE_SOURCES,
  MAX_SESSIONS_BACK,
  MAX_PROFILE_ROWS,
  SESSION_RANGES,
  OPERAND_KINDS,
  isSeries,
  SMOOTHING_KINDS,
  MAX_LOOKBACK,
} from './constants';
import {
  hasOffset,
  hasPeriod,
  CLOCK,
} from './internal';

/** A média de um indicador (do RSI): o tipo e o período dela. */
export class SmoothingDto {
  @IsIn(SMOOTHING_KINDS)
  kind: (typeof SMOOTHING_KINDS)[number];

  @IsInt()
  @Min(2)
  @Max(MAX_LOOKBACK)
  period: number;
}

/**
 * Um lado de uma condição: um preço de uma vela, um indicador (média simples,
 * exponencial, ponderada ou RSI) ou um número.
 *
 * As velas contam-se para trás a partir da atual: -1 é a vela que está a abrir
 * (só a abertura é conhecida), -2 a última fechada, e assim por diante. Noutro
 * tempo gráfico, a -1 é a vela dele que está a decorrer e a -2 a última fechada.
 */
export class OperandDto {
  @IsIn(OPERAND_KINDS)
  kind: (typeof OPERAND_KINDS)[number];

  // Preço da vela, ou o preço de que se faz a média
  @ValidateIf((operand: OperandDto) => isSeries(operand.kind))
  @IsIn(PRICE_FIELDS)
  field?: (typeof PRICE_FIELDS)[number];

  @ValidateIf((operand: OperandDto) => hasOffset(operand.kind))
  @IsInt()
  @Min(-MAX_LOOKBACK)
  @Max(-1)
  offset?: number;

  // Outro tempo gráfico (o diário numa simulação de 1 h); sem ele, o da simulação
  @IsOptional()
  @IsIn(TIMEFRAMES)
  timeframe?: Timeframe;

  // O indicador de onde veio a média (só para o formulário se reconstruir)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  indicator?: string;

  @ValidateIf((operand: OperandDto) => hasPeriod(operand.kind))
  @IsInt()
  @Min(2)
  @Max(MAX_LOOKBACK)
  period?: number;

  // A média do RSI em vez do RSI (a linha dela)
  @IsOptional()
  @ValidateNested()
  @Type(() => SmoothingDto)
  smoothing?: SmoothingDto;

  @ValidateIf((operand: OperandDto) => operand.kind === 'number')
  @IsNumber()
  value?: number;

  // Um nível do dia ou da semana; na faixa de abertura, a hora local e os minutos dela
  @ValidateIf((operand: OperandDto) => operand.kind === 'session')
  @IsIn(SESSION_LEVELS)
  level?: (typeof SESSION_LEVELS)[number];

  @ValidateIf(
    (operand: OperandDto) =>
      operand.kind === 'session' && isRangeLevel(operand.level),
  )
  @Matches(CLOCK)
  rangeStart?: string;

  @ValidateIf(
    (operand: OperandDto) =>
      operand.kind === 'session' && isRangeLevel(operand.level),
  )
  @IsInt()
  @Min(1)
  @Max(720)
  rangeMinutes?: number;

  // O perfil de volume: o nível, de que sessão e as opções do indicador
  @ValidateIf((operand: OperandDto) => operand.kind === 'profile')
  @IsIn(PROFILE_LEVELS)
  profileLevel?: (typeof PROFILE_LEVELS)[number];

  @ValidateIf((operand: OperandDto) => operand.kind === 'profile')
  @IsIn(PROFILE_SOURCES)
  profile?: (typeof PROFILE_SOURCES)[number];

  // Numa sessão acabada: 1 = a anterior, 2 = a de antes, …
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SESSIONS_BACK)
  sessionsBack?: number;

  @ValidateIf((operand: OperandDto) => operand.kind === 'profile')
  @IsIn(PROFILE_SESSIONS)
  session?: (typeof PROFILE_SESSIONS)[number];

  @IsOptional()
  @Matches(SESSION_RANGES)
  customSession?: string;

  @IsOptional()
  @IsIn(PROFILE_EXCHANGES)
  exchange?: (typeof PROFILE_EXCHANGES)[number];

  @ValidateIf((operand: OperandDto) => operand.kind === 'profile')
  @IsIn(PROFILE_ROWS_LAYOUTS)
  rowsLayout?: (typeof PROFILE_ROWS_LAYOUTS)[number];

  @ValidateIf((operand: OperandDto) => operand.kind === 'profile')
  @IsInt()
  @Min(1)
  @Max(MAX_PROFILE_ROWS)
  rowSize?: number;

  // Nos ticks por linha: o tick do preço (o do gráfico, pelas casas decimais do mercado)
  @IsOptional()
  @IsNumber()
  @Min(0.0000000001)
  tickSize?: number;

  @ValidateIf((operand: OperandDto) => operand.kind === 'profile')
  @IsNumber()
  @Min(1)
  @Max(100)
  vaPct?: number;
}
