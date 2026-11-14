import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export const DEFAULT_PAYMENT_MONTHS = 12;
export const MAX_PAYMENT_MONTHS = 36;
export const MAX_FUTURE_MONTHS = 24;
// Um intervalo escolhido à mão não passa disto
export const MAX_RANGE_MONTHS = 60;

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export class MonthlyPaymentsQueryDto {
  // Quantos meses para trás, o atual incluído
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAYMENT_MONTHS)
  months?: number;

  // Quantos meses para a frente, depois do atual (a previsão)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_FUTURE_MONTHS)
  future?: number;

  // Um intervalo à mão, `YYYY-MM` a `YYYY-MM` (os dois inclusive): substitui `months` e `future`
  @IsOptional()
  @Matches(MONTH)
  from?: string;

  @IsOptional()
  @Matches(MONTH)
  to?: string;

  // Só os pagamentos deste fornecedor
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  // Só os dos fornecedores deste grupo
  @IsOptional()
  @IsUUID()
  supplierGroupId?: string;

  // Contar também os rascunhos (por omissão só os concluídos)
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeDrafts?: boolean;
}
