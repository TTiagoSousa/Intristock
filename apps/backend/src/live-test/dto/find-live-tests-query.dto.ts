import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

// Os testes ao vivo de uma simulação (sem ela, todos os do utilizador); `active`
// deixa só os que estão à espera, a correr ou a parar
export class FindLiveTestsQueryDto {
  @IsOptional()
  @IsUUID()
  runId?: string;

  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  active?: boolean;
}
