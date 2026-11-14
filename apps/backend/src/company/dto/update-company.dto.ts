import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

// Tudo opcional: só se atualiza o que vier no body.
//
// O `parentId` não está aqui de propósito — mudar uma empresa de mãe mexe na
// hierarquia inteira e merece decisão à parte, não um campo num formulário de
// definições.
export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsUUID()
  countryId?: string;

  // Só passa enquanto a empresa não tiver pagamentos. Depois disso, mudá-la
  // alterava o significado de tudo o que já lá está gravado.
  @IsOptional()
  @IsUUID()
  currencyId?: string;
}
