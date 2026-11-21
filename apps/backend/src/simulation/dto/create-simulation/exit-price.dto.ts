// O preço de uma saída ou de um nível
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
  MAX_LOOKBACK,
} from './constants';
import {
  hasOffset,
  hasPeriod,
  CLOCK,
} from './internal';

// Preço de saída: a abertura da vela (ao mercado) ou um nível — o preço de
// uma vela, uma média ou um valor fixo
export const EXIT_PRICE_KINDS = ['market', ...OPERAND_KINDS] as const;

export class ExitPriceDto {
  @IsIn(EXIT_PRICE_KINDS)
  kind: (typeof EXIT_PRICE_KINDS)[number];

  @ValidateIf((price: ExitPriceDto) => isSeries(price.kind))
  @IsIn(PRICE_FIELDS)
  field?: (typeof PRICE_FIELDS)[number];

  @ValidateIf((price: ExitPriceDto) => hasOffset(price.kind))
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

  @ValidateIf((price: ExitPriceDto) => hasPeriod(price.kind))
  @IsInt()
  @Min(2)
  @Max(MAX_LOOKBACK)
  period?: number;

  @ValidateIf((price: ExitPriceDto) => price.kind === 'number')
  @IsNumber()
  @Min(0)
  value?: number;

  @ValidateIf((price: ExitPriceDto) => price.kind === 'session')
  @IsIn(SESSION_LEVELS)
  level?: (typeof SESSION_LEVELS)[number];

  @ValidateIf(
    (price: ExitPriceDto) =>
      price.kind === 'session' && isRangeLevel(price.level),
  )
  @Matches(CLOCK)
  rangeStart?: string;

  @ValidateIf(
    (price: ExitPriceDto) =>
      price.kind === 'session' && isRangeLevel(price.level),
  )
  @IsInt()
  @Min(1)
  @Max(720)
  rangeMinutes?: number;

  // O perfil de volume: o nível, de que sessão e as opções do indicador
  @ValidateIf((price: ExitPriceDto) => price.kind === 'profile')
  @IsIn(PROFILE_LEVELS)
  profileLevel?: (typeof PROFILE_LEVELS)[number];

  @ValidateIf((price: ExitPriceDto) => price.kind === 'profile')
  @IsIn(PROFILE_SOURCES)
  profile?: (typeof PROFILE_SOURCES)[number];

  // Numa sessão acabada: 1 = a anterior, 2 = a de antes, …
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SESSIONS_BACK)
  sessionsBack?: number;

  @ValidateIf((price: ExitPriceDto) => price.kind === 'profile')
  @IsIn(PROFILE_SESSIONS)
  session?: (typeof PROFILE_SESSIONS)[number];

  @IsOptional()
  @Matches(SESSION_RANGES)
  customSession?: string;

  @IsOptional()
  @IsIn(PROFILE_EXCHANGES)
  exchange?: (typeof PROFILE_EXCHANGES)[number];

  @ValidateIf((price: ExitPriceDto) => price.kind === 'profile')
  @IsIn(PROFILE_ROWS_LAYOUTS)
  rowsLayout?: (typeof PROFILE_ROWS_LAYOUTS)[number];

  @ValidateIf((price: ExitPriceDto) => price.kind === 'profile')
  @IsInt()
  @Min(1)
  @Max(MAX_PROFILE_ROWS)
  rowSize?: number;

  // Nos ticks por linha: o tick do preço (o do gráfico, pelas casas decimais do mercado)
  @IsOptional()
  @IsNumber()
  @Min(0.0000000001)
  tickSize?: number;

  @ValidateIf((price: ExitPriceDto) => price.kind === 'profile')
  @IsNumber()
  @Min(1)
  @Max(100)
  vaPct?: number;
}
