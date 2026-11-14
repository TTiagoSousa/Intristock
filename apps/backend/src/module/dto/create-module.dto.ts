import { IsBoolean, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateModuleDto {
  // Identificador técnico, usado pelo frontend para saber que secções mostrar
  // (ex. "reservations"). Só minúsculas, números e hífens.
  @IsString()
  @MinLength(2)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'name só pode ter minúsculas, números e hífens',
  })
  name: string;

  @IsString()
  @MinLength(2)
  label: string;

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
