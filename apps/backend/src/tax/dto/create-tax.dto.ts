import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export const TAX_TYPES = ['system', 'custom'] as const;
export type TaxType = (typeof TAX_TYPES)[number];

export class CreateTaxDto {
  @IsUUID()
  countryId: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  rate: number;

  @IsString()
  @MinLength(2)
  category: string;

  @IsIn(TAX_TYPES)
  type: TaxType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
