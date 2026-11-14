import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export const MEMBER_CONTRACT_TYPES = [
  'permanent',
  'fixed_term',
  'services',
  'internship',
  'other',
] as const;

export class CreateMemberContractDto {
  @IsIn(MEMBER_CONTRACT_TYPES)
  type: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  title?: string | null;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  notes?: string | null;
}

export class UpdateMemberContractDto {
  @IsOptional()
  @IsIn(MEMBER_CONTRACT_TYPES)
  type?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  title?: string | null;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  notes?: string | null;
}
