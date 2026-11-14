import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

// Uma conta fechada não desaparece: os pagamentos que passaram por ela têm de
// continuar a poder apontar-lhe. `inactive` é o que se usa para a tirar de
// circulação sem partir histórico.
export const BANK_ACCOUNT_STATUSES = ['active', 'inactive'] as const;
export type BankAccountStatus = (typeof BANK_ACCOUNT_STATUSES)[number];

// Tudo opcional: só se atualiza o que vier no body
export class UpdateBankAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  // String vazia limpa o IBAN — uma conta pode não ter (cartão, plataforma)
  @IsOptional()
  @IsString()
  iban?: string;

  @IsOptional()
  @IsUUID()
  platformId?: string;

  @IsOptional()
  @IsUUID()
  currencyId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialBalance?: number;

  @IsOptional()
  @IsIn(BANK_ACCOUNT_STATUSES)
  status?: BankAccountStatus;
}
