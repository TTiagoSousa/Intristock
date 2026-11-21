// As saídas com condição de uma entrada
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  MAX_NAME,
} from './constants';
import {
  CONDITION_MATCHES,
  ConditionDto,
} from './condition.dto';
import {
  ExitPriceDto,
} from './exit-price.dto';
import {
  ScheduleDto,
} from './sizing-schedule.dto';

/**
 * Uma saída de uma entrada: quando as condições se cumprem (todas; sem
 * nenhuma, sempre), sai ao preço indicado.
 */
export class ExitRuleDto {
  // Um nome para os resumos ("entrou por X, saiu por Y"); sem nome, o número
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  name?: string | null;

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions: ConditionDto[];

  // Todas (por omissão) ou qualquer uma
  @IsOptional()
  @IsIn(CONDITION_MATCHES)
  match?: (typeof CONDITION_MATCHES)[number];

  @ValidateNested()
  @Type(() => ExitPriceDto)
  price: ExitPriceDto;

  // Só vale nestes dias e horas (ou exceto neles)
  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleDto)
  schedule?: ScheduleDto;
}
