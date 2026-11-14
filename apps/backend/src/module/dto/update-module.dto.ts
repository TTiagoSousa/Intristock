import { IsBoolean, IsOptional, IsString, Matches, MinLength } from 'class-validator';

// Tudo opcional: só se atualiza o que vier no body
export class UpdateModuleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'name só pode ter minúsculas, números e hífens',
  })
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  label?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
