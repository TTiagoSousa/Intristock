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
import { DEBT_MOVEMENT_KINDS } from './personal-debt.dto';

export const DEFAULT_SUMMARY_MONTHS = 12;
export const DEFAULT_SUMMARY_FUTURE = 12;
export const DEFAULT_DUE_MONTHS = 3;
// Um intervalo escolhido à mão no resumo não passa disto (uma casa leva décadas)
export const MAX_DEBT_RANGE_MONTHS = 180;

// Os movimentos, com filtros (as datas inclusive)
export class DebtMovementsQueryDto {
  @IsOptional()
  @IsUUID()
  debtId?: string;

  @IsOptional()
  @IsIn(DEBT_MOVEMENT_KINDS)
  kind?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

// As prestações por pagar, das em atraso às dos próximos `months` meses
export class DebtsDueQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24)
  months?: number;
}

// O resumo: os últimos `months` meses e a projeção de `future` à frente, em `currencyId`
export class DebtSummaryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  months?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  future?: number;

  // Um intervalo à mão para o gráfico, `YYYY-MM` a `YYYY-MM` (os dois inclusive):
  // no lugar de `months` e `future`; os meses depois deste são projetados
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  to?: string;

  @IsOptional()
  @IsUUID()
  currencyId?: string;
}
