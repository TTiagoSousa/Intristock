import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** Aceitar ou recusar um convite ou uma proposta (a nota só nas propostas). */
export class RespondInvitationDto {
  @IsBoolean()
  accept: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export const PAYMENT_SOURCES = ['company_payment', 'time_tracking'] as const;

/** Confirmar (ou dizer que não) que se recebeu um pagamento registado pela empresa. */
export class ConfirmPaymentDto {
  @IsIn(PAYMENT_SOURCES)
  source: (typeof PAYMENT_SOURCES)[number];

  @IsBoolean()
  received: boolean;
}
