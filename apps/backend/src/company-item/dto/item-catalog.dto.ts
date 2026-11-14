import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

// Quantos planos se juntam de uma vez (uma prop firm tem algumas dezenas)
export const MAX_PLANS_PER_REQUEST = 100;

export class CreateItemsFromPlansDto {
  @IsUUID()
  platformId: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_PLANS_PER_REQUEST)
  @IsUUID('all', { each: true })
  planIds: string[];
}
