import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { USER_ROLES, type UserRole } from '../roles';

/// Conta criada pelo admin. Não há registo público: numa instalação self-host só
/// entra quem o admin deixa entrar.
export class CreateManagedUserDto {
  @IsString()
  @MinLength(2)
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;
}
