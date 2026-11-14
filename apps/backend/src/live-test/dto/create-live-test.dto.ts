import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
} from 'class-validator';

// Um teste ao vivo a partir de uma simulação: começa agora (ou numa data) e
// acaba numa data ou só quando o mandarem parar
export class CreateLiveTestDto {
  @IsUUID()
  runId!: string;

  // Sem ele, agora
  @IsOptional()
  @IsDateString()
  startAt?: string;

  // Sem ele, sem fim
  @IsOptional()
  @IsDateString()
  endAt?: string;

  // Sem ele, o da simulação
  @IsOptional()
  @IsNumber()
  @IsPositive()
  initialCapital?: number;
}
