import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

/// Bloquear até uma data (ISO). Para sempre é desativar a conta.
export class BlockUserDto {
  @IsDateString()
  until: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
