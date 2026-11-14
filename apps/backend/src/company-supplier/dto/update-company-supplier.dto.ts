import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SupplierPhoneDto } from './supplier-phone.dto';
import {
  COMPANY_SUPPLIER_TYPES,
  CompanySupplierType,
  SUPPLIER_PAYMENT_METHODS,
  SupplierPaymentMethod,
} from './create-company-supplier.dto';

// Tudo opcional: só se atualiza o que vier no body.
// O companyId e o id do fornecedor vêm da rota.
export class UpdateCompanySupplierDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsIn(COMPANY_SUPPLIER_TYPES)
  type?: CompanySupplierType;

  @IsOptional()
  @IsString()
  alias?: string;

  // Grupo de fornecedores (opcional) — tem de ser da mesma empresa
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsUUID()
  countryId?: string;

  @IsOptional()
  @IsUUID()
  currencyId?: string;

  @IsOptional()
  @IsIn(SUPPLIER_PAYMENT_METHODS)
  paymentMethod?: SupplierPaymentMethod;

  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @IsOptional()
  @IsString()
  taxNumber?: string;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsString()
  addressLine?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  city?: string;

  // Telefones extra — a lista inteira, substitui a que existia
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierPhoneDto)
  phones?: SupplierPhoneDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
