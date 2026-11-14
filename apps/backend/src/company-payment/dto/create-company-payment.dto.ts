import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCompanyPaymentTaxDto } from './create-company-payment-tax.dto';
import { CreateCompanyPaymentItemDto } from './create-company-payment-item.dto';

export const PAYMENT_TYPES = ['pay', 'receive', 'internal_transfer'] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PARTY_TYPES = ['supplier', 'shareholder', 'customer', 'member'] as const;
export type PartyType = (typeof PARTY_TYPES)[number];

export const PAYMENT_STATUSES = ['draft', 'completed', 'cancelled'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// O companyId não vive aqui — vem do parâmetro da rota (`/company/:companyId/payments`)
export class CreateCompanyPaymentDto {
  @IsIn(PAYMENT_TYPES)
  paymentType: PaymentType;

  @IsIn(PARTY_TYPES)
  partyType: PartyType;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  // Com `partyType` member: a quem se paga e, vindo dos próximos pagamentos, o
  // salário ou recibo verde e o que se paga dele (`YYYY-MM`, `YYYY-MM:holiday`,
  // `YYYY-MM:christmas` ou `once`)
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @IsOptional()
  @IsUUID()
  memberPayId?: string;

  @IsOptional()
  @IsString()
  memberPayPeriod?: string;

  @IsOptional()
  @IsUUID()
  fromBankAccountId?: string;

  @IsOptional()
  @IsUUID()
  toBankAccountId?: string;

  // O valor que sai (ou entra) na conta bancária, já com impostos. É sempre
  // conferido contra a base + os impostos calculados.
  @IsNumber()
  @Min(0)
  amount: number;

  // O valor sem imposto, quando o pagamento não tem linhas de item. Com linhas,
  // a base é a soma delas e este campo é ignorado.
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseAmount?: number;

  // `true` quando os preços escritos já trazem o imposto lá dentro (a fatura
  // diz 123 € com IVA). O backend faz a conta ao contrário e guarda sempre os
  // valores sem imposto, para dois pagamentos serem comparáveis mesmo que
  // tenham sido registados de maneiras diferentes.
  @IsOptional()
  @IsBoolean()
  pricesIncludeTax?: boolean;

  // A moeda do pagamento — o valor, as linhas e os impostos estão nela. Sem
  // ela, a da empresa.
  @IsOptional()
  @IsUUID()
  currencyId?: string;

  // Só num pagamento noutra moeda: o que saiu na moeda da empresa (o valor do
  // extrato). A taxa passa a ser este ÷ `amount`. Sem ele, vale a cotação do
  // dia do pagamento.
  @IsOptional()
  @IsNumber()
  @IsPositive()
  companyAmount?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsDateString()
  paymentDate: string;

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: PaymentStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCompanyPaymentTaxDto)
  taxes?: CreateCompanyPaymentTaxDto[];

  // Detalhe do que foi comprado. Opcional: um pagamento pode ser só um valor
  // (uma transferência, por exemplo) sem nada para discriminar.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCompanyPaymentItemDto)
  items?: CreateCompanyPaymentItemDto[];
}
