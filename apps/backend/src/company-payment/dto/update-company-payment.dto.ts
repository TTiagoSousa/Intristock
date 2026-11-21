import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { PAYMENT_STATUSES, PaymentStatus } from './create-company-payment.dto';

/**
 * O que se corrige num pagamento já gravado.
 *
 * O valor, as linhas de item e os impostos **não** estão aqui de propósito:
 * mexer neles obriga a refazer as contas, o stock e as fichas de ativo que a
 * compra originou, e isso é apagar e voltar a criar, não editar. Aqui ficam os
 * campos que se enganam a escrever — e, num pagamento noutra moeda, o valor
 * na moeda da empresa: corrigi-lo muda a taxa e o stock e os ativos que a
 * compra criou acompanham.
 */
export class UpdateCompanyPaymentDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  // Mudar a data arrasta os movimentos de stock que este pagamento gerou: eles
  // aconteceram quando ele aconteceu
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  // Concluir cria o stock e os ativos; voltar a rascunho ou cancelar tira-os
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: PaymentStatus;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  fromBankAccountId?: string;

  @IsOptional()
  @IsUUID()
  toBankAccountId?: string;

  // O valor na moeda da empresa escrito à mão (o do extrato): a taxa passa a
  // ser este ÷ `amount` e fica manual
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  companyAmount?: number;

  // Volta à cotação de mercado do dia do pagamento, deixando o valor manual
  @IsOptional()
  @IsBoolean()
  useMarketRate?: boolean;
}
