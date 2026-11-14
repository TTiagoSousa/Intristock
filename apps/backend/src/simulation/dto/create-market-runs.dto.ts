import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

// Até quantos mercados de uma vez (cada um é uma simulação na fila)
export const MAX_MARKET_RUNS = 10;

// 3.7 — A mesma estratégia corrida noutros mercados: os instrumentos
export class CreateMarketRunsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MARKET_RUNS)
  @IsUUID('all', { each: true })
  instrumentIds!: string[];
}
