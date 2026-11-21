// Os indicadores do separador Indicadores
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
  PROFILE_SESSIONS,
  PROFILE_EXCHANGES,
  PROFILE_ROWS_LAYOUTS,
  PROFILE_VOLUMES,
  MAX_PROFILE_ROWS,
  SESSION_RANGES,
  INDICATOR_DEFINITION_KINDS,
  MAX_SHIFT,
  MAX_LOOKBACK,
} from './constants';
import {
  SmoothingDto,
} from './operand.dto';

/**
 * Um indicador definido uma vez e usado pelo nome nas condições. O motor não o
 * lê: cada uso já vem como uma média com estes valores. Fica na estratégia
 * para o formulário mostrar os indicadores ao abrir a simulação.
 */
export class IndicatorDto {
  @IsString()
  @MaxLength(MAX_NAME)
  id: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  name?: string | null;

  @IsIn(INDICATOR_DEFINITION_KINDS)
  kind: (typeof INDICATOR_DEFINITION_KINDS)[number];

  // As médias e o RSI; o perfil de volume não tem período nem fonte
  @ValidateIf((indicator: IndicatorDto) => indicator.kind !== 'svp')
  @IsInt()
  @Min(2)
  @Max(MAX_LOOKBACK)
  period?: number;

  @ValidateIf((indicator: IndicatorDto) => indicator.kind !== 'svp')
  @IsIn(PRICE_FIELDS)
  field?: (typeof PRICE_FIELDS)[number];

  // O perfil de volume: as opções do indicador da trading-chart (o gráfico
  // desenha-o com elas; cada uso já as leva)
  @IsOptional()
  @IsIn(PROFILE_SESSIONS)
  session?: (typeof PROFILE_SESSIONS)[number];

  @IsOptional()
  @Matches(SESSION_RANGES)
  customSession?: string;

  @IsOptional()
  @IsIn(PROFILE_EXCHANGES)
  exchange?: (typeof PROFILE_EXCHANGES)[number];

  @IsOptional()
  @IsIn(PROFILE_ROWS_LAYOUTS)
  rowsLayout?: (typeof PROFILE_ROWS_LAYOUTS)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PROFILE_ROWS)
  rowSize?: number;

  @IsOptional()
  @IsIn(PROFILE_VOLUMES)
  volume?: (typeof PROFILE_VOLUMES)[number];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  vaPct?: number;

  @IsOptional()
  @IsIn(TIMEFRAMES)
  timeframe?: Timeframe;

  // Nas médias: quantas velas para a direita (cada uso já vem com ele no offset)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_SHIFT)
  shift?: number;

  // No RSI: a média dele, que as condições podem usar como outra linha
  @IsOptional()
  @ValidateNested()
  @Type(() => SmoothingDto)
  smoothing?: SmoothingDto | null;
}
