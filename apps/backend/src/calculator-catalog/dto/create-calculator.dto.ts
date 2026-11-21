import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCalculatorDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(1)
  abbreviation: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
