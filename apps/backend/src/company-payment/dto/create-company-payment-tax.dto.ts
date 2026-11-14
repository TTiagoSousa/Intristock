import { IsIn, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export const TAX_CALCULATION_TYPES = [
  // Valor indicado à mão (ex. imposto de selo de valor fixo)
  'real',
  // Percentagem sobre a base do pagamento — o caso normal do IVA
  'on_paid_amount',
  // Percentagem sobre a base da linha anterior
  'on_previous_row_amount',
  // Percentagem sobre o total da linha anterior — imposto sobre imposto
  'on_previous_row_total',
] as const;
export type TaxCalculationType = (typeof TAX_CALCULATION_TYPES)[number];

export class CreateCompanyPaymentTaxDto {
  @IsUUID()
  taxId: string;

  // Por omissão o imposto incide sobre a base do pagamento
  @IsOptional()
  @IsIn(TAX_CALCULATION_TYPES)
  calculationType?: TaxCalculationType;

  // Sem isto vale a taxa do catálogo. Serve para registar um pagamento antigo
  // com a taxa que estava em vigor na altura.
  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number;

  // Só é lido quando `calculationType` é 'real' — nos outros casos o valor é
  // calculado no backend e o que viesse aqui seria ignorado à mesma
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;
}
