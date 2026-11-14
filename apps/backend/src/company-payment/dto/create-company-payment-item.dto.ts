import { IsNumber, IsPositive, IsUUID, Min } from 'class-validator';

// Uma linha de um pagamento: que item foi comprado, quanto e a que preço.
// O `totalPrice` não vem no body — é calculado no backend a partir destes dois,
// para o cliente nunca poder mandar um total que não bate com as linhas.
export class CreateCompanyPaymentItemDto {
  @IsUUID()
  itemId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}
