import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export const LIVE_EVENT_KINDS = [
  'system',
  'condition',
  'conditionsMet',
  'conditionsSnapshot',
  'setup',
  'signal',
  'order',
  'opened',
  'partial',
  'add',
  'stopMove',
  'closed',
  'touch',
  'deposit',
  'pause',
] as const;
export type Live_Event_Kind = (typeof LIVE_EVENT_KINDS)[number];

export const DEFAULT_EVENTS_TAKE = 100;
export const MAX_EVENTS_TAKE = 500;

// Os registos de um teste, dos mais recentes para trás, às páginas: `before` é o
// id do último que já se tem; `kinds` (separados por vírgulas) filtra
export class FindLiveEventsQueryDto {
  @IsOptional()
  @IsNumberString()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_EVENTS_TAKE)
  take?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsIn(LIVE_EVENT_KINDS, { each: true })
  kinds?: Live_Event_Kind[];
}
