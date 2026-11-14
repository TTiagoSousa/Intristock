import { IsOptional, IsString, MinLength } from 'class-validator';

// Tudo opcional: só se atualiza o que vier no body.
// O companyId e o id do grupo vêm da rota.
export class UpdateCompanySupplierGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
