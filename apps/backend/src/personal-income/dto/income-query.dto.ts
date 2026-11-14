import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { INCOME_KINDS, INCOME_STATUSES } from './personal-income.dto';

export const DEFAULT_SUMMARY_MONTHS = 12;
export const DEFAULT_SUMMARY_FUTURE = 3;
export const DEFAULT_EXPECTED_MONTHS = 3;
// Um intervalo escolhido à mão não passa disto
export const MAX_SUMMARY_RANGE_MONTHS = 60;

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

// Os ganhos registados, com filtros (as datas inclusive)
export class IncomesQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(INCOME_KINDS)
  kind?: string;

  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @IsOptional()
  @IsIn(INCOME_STATUSES)
  status?: string;
}

// Os esperados (salários por receber), dos atrasados aos próximos `months` meses
export class ExpectedIncomesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24)
  months?: number;
}

// O resumo: os últimos `months` meses e `future` à frente, contados em `currencyId`
export class IncomeSummaryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  months?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(12)
  future?: number;

  // Um intervalo à mão para o gráfico e as somas por tipo e por fonte, `YYYY-MM` a
  // `YYYY-MM` (os dois inclusive): substitui `months` e `future` só aí, os cartões não mudam
  @IsOptional()
  @Matches(MONTH)
  from?: string;

  @IsOptional()
  @Matches(MONTH)
  to?: string;

  @IsOptional()
  @IsUUID()
  currencyId?: string;
}
