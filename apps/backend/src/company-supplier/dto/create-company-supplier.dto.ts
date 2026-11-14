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

export const COMPANY_SUPPLIER_TYPES = [
  'company',
  'individual',
  'partnership',
] as const;
export type CompanySupplierType = (typeof COMPANY_SUPPLIER_TYPES)[number];

export const SUPPLIER_PAYMENT_METHODS = ['bank_account', 'direct'] as const;
export type SupplierPaymentMethod = (typeof SUPPLIER_PAYMENT_METHODS)[number];

// O companyId não vive aqui — vem do parâmetro da rota (`/company/:companyId/suppliers`)
export class CreateCompanySupplierDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsIn(COMPANY_SUPPLIER_TYPES)
  type: CompanySupplierType;

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

  // Número de contribuinte do fornecedor (NIF/VAT) — não é FK para Tax
  @IsOptional()
  @IsString()
  taxNumber?: string;

  // Pessoa de contacto / telefone
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
