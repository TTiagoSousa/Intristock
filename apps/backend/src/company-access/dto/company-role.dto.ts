import { ArrayUnique, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { COMPANY_PERMISSIONS } from 'src/company/permissions/companyPermissions';

export class CreateCompanyRoleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsArray()
  @ArrayUnique()
  @IsIn(COMPANY_PERMISSIONS, { each: true })
  permissions: string[];
}

export class UpdateCompanyRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(COMPANY_PERMISSIONS, { each: true })
  permissions?: string[];
}
