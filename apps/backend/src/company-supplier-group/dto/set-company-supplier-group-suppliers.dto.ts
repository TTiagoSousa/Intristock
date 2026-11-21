import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

// Define o conjunto exato de fornecedores do grupo. Pode vir vazio (limpa o grupo).
export class SetCompanySupplierGroupSuppliersDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @IsUUID('4', { each: true })
  supplierIds: string[];
}
