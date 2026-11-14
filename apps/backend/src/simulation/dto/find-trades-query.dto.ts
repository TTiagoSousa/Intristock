import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { PaginationQueryDto } from 'src/common/pagination';

// stop_loss, take_profit, liquidation, opposite, excluded, end ou signal:N (a
// saída N da entrada)
export const EXIT_KEY =
  /^(stop_loss|trailing_stop|break_even|take_profit|time|liquidation|opposite|excluded|end|signal:[1-5])$/;

/** Os trades de uma simulação, só os de uma entrada e/ou de uma saída. */
export class FindTradesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  entryRule?: number;

  @IsOptional()
  @Matches(EXIT_KEY)
  exit?: string;

  // Pela ordem de entrada (asc, por omissão) ou do mais recente (desc, o diário 4.7)
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
