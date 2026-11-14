import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export const PLATFORM_TYPES = ['bank', 'broker', 'exchange', 'postal', 'prop_firm'] as const;
export type PlatformType = (typeof PLATFORM_TYPES)[number];

export class CreatePlatformDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsIn(PLATFORM_TYPES)
  type: PlatformType;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsUUID()
  countryId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
