import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { COMPANY_PERMISSIONS } from 'src/company/permissions/companyPermissions';

// Os dados da pessoa, todos opcionais. Uma string vazia apaga o campo; null também.
export class CompanyMemberProfileDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  name?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  phone?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  jobTitle?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  taxNumber?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  socialSecurityNumber?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  idDocumentNumber?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsDateString()
  birthDate?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  addressLine?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  postalCode?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  city?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsUUID()
  countryId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  iban?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsUUID()
  currencyId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsUUID()
  bankAccountId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  notes?: string | null;
}

/**
 * Com `accountEmail`, junta uma conta da instalação (entra na app, com cargo); sem ele
 * é um membro sem conta, só para registar os salários, os contratos e os dados —
 * e aí o `name` é obrigatório.
 */
export class AddCompanyMemberDto extends CompanyMemberProfileDto {
  // O email da conta (não o `email` de contacto dos dados)
  @IsOptional()
  @IsEmail()
  accountEmail?: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;
}

export class UpdateCompanyMemberDto extends CompanyMemberProfileDto {
  // null tira o cargo
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  roleId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(COMPANY_PERMISSIONS, { each: true })
  extraPermissions?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(COMPANY_PERMISSIONS, { each: true })
  deniedPermissions?: string[];
}
