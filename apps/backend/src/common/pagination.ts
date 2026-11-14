import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Paginação partilhada por todas as listagens de empresa.
 *
 * Dez por página, e cada página é um pedido: a página 2 vai buscar os dez
 * seguintes em vez de a app trazer tudo e cortar no ecrã. É isso que faz uma
 * empresa com milhares de pagamentos abrir tão depressa como uma com dez.
 */
export const DEFAULT_TAKE = 10;

// Teto para um `take` enorme não conseguir arrastar a tabela toda de uma vez
export const MAX_TAKE = 100;

export class PaginationQueryDto {
  // Quantos saltar. Vem em string no URL — o `@Type` é que a converte
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_TAKE)
  take?: number;
}

/**
 * O que uma listagem paginada devolve.
 *
 * O `total` é o número de linhas que existem, não o desta página — é dele que
 * o frontend tira quantas páginas há sem as ir buscar todas.
 */
export interface Paginated<T> {
  items: T[];
  total: number;
}

/** Os limites já resolvidos, com os valores por omissão aplicados. */
export function resolvePagination(query: PaginationQueryDto) {
  return { skip: query.skip ?? 0, take: query.take ?? DEFAULT_TAKE };
}
