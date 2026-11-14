import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_UPCOMING_MONTHS = 3;
export const MAX_UPCOMING_MONTHS = 12;

export class UpcomingPaymentsQueryDto {
  // Quantos meses para a frente, o atual incluído
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_UPCOMING_MONTHS)
  months?: number;
}
