import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCompanyBankAccountDto } from './create-company-bank-account.dto';

export class CreateCompanyDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsUUID()
  countryId?: string;

  // A moeda em que as contas desta empresa significam alguma coisa. Opcional:
  // sem ela vale a moeda do país e, na falta dele, o euro.
  @IsOptional()
  @IsUUID()
  currencyId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateCompanyBankAccountDto)
  bankAccounts?: CreateCompanyBankAccountDto[];
}
