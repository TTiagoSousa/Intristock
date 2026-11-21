// O tamanho, os horários bloqueados e os horários de uma entrada ou saída
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  SIZING_MODES,
  SCHEDULE_MODES,
} from './constants';
import {
  CLOCK,
} from './internal';

/** Quanto entra em cada trade. Em percent e risk o valor é uma %. */
export class SizingDto {
  @IsIn(SIZING_MODES)
  mode: (typeof SIZING_MODES)[number];

  @ValidateIf((sizing: SizingDto) => sizing.mode !== 'all')
  @IsNumber()
  @Min(0.01)
  @Max(1_000_000_000)
  value?: number;
}

/** Dias (0 = segunda) e horas; sem dias, todos; sem horas, o dia todo. */
export class BlockedTimeDto {
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  days: number[];

  @IsOptional()
  @Matches(CLOCK)
  from?: string | null;

  @IsOptional()
  @Matches(CLOCK)
  to?: string | null;
}

/** Quando uma entrada, um stop ou uma saída valem: só nestes dias e horas, ou exceto neles. */
export class ScheduleDto {
  @IsIn(SCHEDULE_MODES)
  mode: (typeof SCHEDULE_MODES)[number];

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => BlockedTimeDto)
  rules: BlockedTimeDto[];
}
