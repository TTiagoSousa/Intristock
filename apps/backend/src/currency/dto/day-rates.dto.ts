import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export const MAX_DAY_RATE_ITEMS = 1000;

export class DayRateItemDto {
  @IsUUID()
  from: string;

  // Sem dia (ou no futuro), o de hoje
  @IsOptional()
  @IsDateString()
  day?: string;
}

// As cotações para `to` de cada moeda em cada dia — os Registos das finanças
// pessoais mostram cada valor na moeda escolhida
export class DayRatesDto {
  @IsUUID()
  to: string;

  @IsArray()
  @ArrayMaxSize(MAX_DAY_RATE_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => DayRateItemDto)
  items: DayRateItemDto[];
}
