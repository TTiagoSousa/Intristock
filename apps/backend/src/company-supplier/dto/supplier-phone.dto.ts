import { IsOptional, IsString, MinLength } from 'class-validator';

// Um telefone extra do fornecedor. A lista vem sempre inteira e substitui a
// que estava: é assim que se apaga ou muda um número.
export class SupplierPhoneDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsString()
  @MinLength(3)
  number: string;
}
