import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

// Os intervalos da Binance que o gráfico oferece
export const CANDLE_INTERVALS = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '1d',
  '1w',
] as const;
export type CandleInterval = (typeof CANDLE_INTERVALS)[number];

export const MAX_CANDLES = 1000;

// Um bloco de velas: as `limit` mais recentes que abriram antes de `to`
export class FindCandlesDto {
  @IsUUID()
  instrumentId: string;

  @IsIn(CANDLE_INTERVALS)
  interval: CandleInterval;

  // Segundos UTC, exclusivo. Sem ele, as últimas velas (até agora)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  to?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_CANDLES)
  limit?: number;
}
