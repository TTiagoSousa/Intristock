import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from 'src/common/pagination';

export const INSTRUMENT_TYPES = [
  'spot',
  'perpetual',
  'future',
  'option',
  'cfd',
  'index',
] as const;
export type InstrumentType = (typeof INSTRUMENT_TYPES)[number];

export const INSTRUMENT_STATUSES = ['trading', 'halted', 'delisted'] as const;
export type InstrumentStatus = (typeof INSTRUMENT_STATUSES)[number];

// Pesquisa do input de ativos. Sem estado, só aparece o que está a negociar
export class FindInstrumentsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  source?: string;

  @IsOptional()
  @IsIn(INSTRUMENT_TYPES)
  type?: InstrumentType;

  @IsOptional()
  @IsIn(INSTRUMENT_STATUSES)
  status?: InstrumentStatus;
}
