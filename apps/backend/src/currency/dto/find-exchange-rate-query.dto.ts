import { IsDateString, IsUUID } from 'class-validator';

// Quanto vale 1 de `from` em `to` no dia `date` — o formulário de pagamento
// usa-a para propor o valor na moeda da empresa
export class FindExchangeRateQueryDto {
  @IsUUID()
  from: string;

  @IsUUID()
  to: string;

  @IsDateString()
  date: string;
}
