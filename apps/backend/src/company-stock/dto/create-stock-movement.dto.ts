import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

// in         — entrada (compra, devolução de cliente, produção)
// out        — saída (venda, consumo na produção, quebra)
// adjustment — acerto de inventário, para o sistema bater com o que está na
//              prateleira. A quantidade é o DELTA, não o total contado.
export const STOCK_MOVEMENT_TYPES = ['in', 'out', 'adjustment'] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const STOCK_SOURCE_TYPES = ['payment', 'manual', 'production'] as const;
export type StockSourceType = (typeof STOCK_SOURCE_TYPES)[number];

export class CreateStockMovementDto {
  @IsUUID()
  itemId: string;

  @IsIn(STOCK_MOVEMENT_TYPES)
  type: StockMovementType;

  // Nas entradas e saídas é sempre positivo: é o `type` que dá o sinal.
  //
  // No acerto (`adjustment`) é um **delta com sinal**: contaste a prateleira e
  // tinhas menos 40 g do que o sistema dizia, lanças -40. Antes o `@Min(0)`
  // impedia isso e obrigava a disfarçar o acerto de saída, o que fazia uma
  // quebra parecer uma venda.
  @IsNumber()
  quantity: number;

  // Só nas entradas. Nas saídas o custo é o médio, calculado das entradas.
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsDateString()
  occurredAt: string;

  @IsOptional()
  @IsString()
  note?: string;
}
