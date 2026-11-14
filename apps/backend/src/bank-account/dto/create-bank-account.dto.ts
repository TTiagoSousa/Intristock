import { IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateBankAccountDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  iban?: string;

  @IsUUID()
  currencyId: string;

  @IsUUID()
  platformId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialBalance?: number;

  @IsOptional()
  @IsUUID()
  companyId?: string;
}
