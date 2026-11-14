import { IsOptional, IsString, MinLength } from 'class-validator';

// O companyId não vive aqui — vem do parâmetro da rota (`/company/:companyId/supplier-groups`)
export class CreateCompanySupplierGroupDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
