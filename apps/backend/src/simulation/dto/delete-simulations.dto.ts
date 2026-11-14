import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

// Até quantas simulações se apagam de uma vez
export const MAX_DELETE_RUNS = 100;

// As simulações escolhidas na lista para apagar
export class DeleteSimulationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_DELETE_RUNS)
  @IsUUID('all', { each: true })
  ids!: string[];
}
