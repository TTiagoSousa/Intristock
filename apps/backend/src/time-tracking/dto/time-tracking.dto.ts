import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const TIME_TRACKING_PROVIDERS = ['solidtime'] as const;
export const TIME_SYNC_INTERVAL_HOURS = [1, 24, 168] as const;
// freelance = recibo verde (com retenção); invoice = fatura; none = não se cobra
export const CLIENT_BILLING = ['freelance', 'invoice', 'none'] as const;
export const HOURS_GROUPS = ['month', 'day', 'client'] as const;
export type HoursGroup = (typeof HOURS_GROUPS)[number];

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** O endereço e a chave: devolve as organizações a que a chave tem acesso (nada se grava). */
export class CheckTimeTrackingDto {
  @IsIn(TIME_TRACKING_PROVIDERS)
  provider: (typeof TIME_TRACKING_PROVIDERS)[number];

  @IsString()
  @MaxLength(300)
  baseUrl: string;

  @IsString()
  @MaxLength(4000)
  token: string;
}

/** A ligação, com a organização escolhida. */
export class CreateTimeTrackingConnectionDto extends CheckTimeTrackingDto {
  @IsString()
  @MaxLength(100)
  organizationId: string;

  @IsOptional()
  @IsIn(TIME_SYNC_INTERVAL_HOURS)
  syncEveryHours?: number;
}

export class UpdateTimeTrackingConnectionDto {
  // Trocar a chave (validada na mesma organização)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  token?: string;

  @IsOptional()
  @IsBoolean()
  paused?: boolean;

  @IsOptional()
  @IsIn(TIME_SYNC_INTERVAL_HOURS)
  syncEveryHours?: number;
}

export class UpdateTimeTrackingClientDto {
  // O cliente (fornecedor) da empresa a que se liga; nulo solta-o
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  supplierId?: string | null;

  // Cria um cliente na empresa com o nome deste (particular ou empresa) e liga-o
  @IsOptional()
  @IsIn(['individual', 'company'])
  createSupplier?: 'individual' | 'company';

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hourlyRate?: number | null;

  @IsOptional()
  @IsIn(CLIENT_BILLING)
  billing?: (typeof CLIENT_BILLING)[number];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  withholdingPct?: number | null;
}

/** A quem vão as horas de uma pessoa da app: um membro, o dono da empresa (`owner`) ou ninguém (`memberId` nulo). */
export class UpdateTimeTrackingPersonDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  memberId?: string | null;

  @IsOptional()
  @IsBoolean()
  owner?: boolean;

  // O que a empresa lhe paga por hora (nulo = o valor das horas) e a retenção disso
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  payRate?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  payWithholdingPct?: number | null;
}

/** O período das horas: as datas (inclusive) e os filtros. */
export class HoursQueryDto {
  @Matches(DAY)
  from: string;

  @Matches(DAY)
  to: string;

  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  personId?: string;

  @IsOptional()
  @IsIn(HOURS_GROUPS)
  group?: HoursGroup;

  // O fuso em que se contam os dias e os meses (o do browser); sem ele, o de Lisboa
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tz?: string;
}

export class EntriesQueryDto extends HoursQueryDto {
  // Só os por pagar (`unpaid`) ou os pagos (`paid`)
  @IsOptional()
  @IsIn(['paid', 'unpaid'])
  status?: 'paid' | 'unpaid';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}

export class TimeTrackingSummaryQueryDto {
  // Os meses do gráfico, para trás a contar deste
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  months?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tz?: string;
}

export const SETTLEMENT_MODES = ['range', 'hours', 'entries'] as const;
// Os registos escolhidos de cada vez (na tabela das horas)
const MAX_ENTRY_IDS = 500;

/**
 * Marcar horas como pagas. `range`: todas as por pagar do cliente (e da pessoa) entre as datas,
 * pelo valor delas ou pelo `amount` dado. `hours`: o cliente pagou `amount` por `hours` horas
 * («50 € por 5 h»): pagam-se as horas por pagar mais antigas (a partir de `fromDate`, se vier)
 * e as que sobram ficam adiantadas, para as horas que vierem. `entries`: as horas por pagar dos
 * registos escolhidos (`entryIds`, todos deste cliente).
 */
export class CreateTimeTrackingSettlementDto {
  @IsUUID()
  clientId: string;

  @IsIn(SETTLEMENT_MODES)
  mode: (typeof SETTLEMENT_MODES)[number];

  @IsOptional()
  @IsUUID()
  personId?: string;

  @ValidateIf((dto: CreateTimeTrackingSettlementDto) => dto.mode === 'range' || dto.fromDate !== undefined)
  @Matches(DAY)
  fromDate?: string;

  @ValidateIf((dto: CreateTimeTrackingSettlementDto) => dto.mode === 'range')
  @Matches(DAY)
  toDate?: string;

  @ValidateIf((dto: CreateTimeTrackingSettlementDto) => dto.mode === 'entries')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ENTRY_IDS)
  @IsUUID('all', { each: true })
  entryIds?: string[];

  @ValidateIf((dto: CreateTimeTrackingSettlementDto) => dto.mode === 'hours')
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  @Max(100000)
  hours?: number;

  // O bruto pago; num `range` sem ele vale o das horas
  @ValidateIf((dto: CreateTimeTrackingSettlementDto) => dto.mode === 'hours' || dto.amount !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  // Sem ela, a do cliente (só nos recibos verdes); nula = sem retenção
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  withholdingPct?: number | null;

  @Matches(DAY)
  paidAt: string;

  // Grava também o recebimento na empresa, nesta conta (do cliente da empresa ligado)
  @IsOptional()
  @IsUUID()
  toBankAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tz?: string;
}

/**
 * A empresa paga a quem fez as horas: os registos escolhidos (`entryIds`, todos da mesma pessoa)
 * ou as horas de uma pessoa entre as datas. Paga o que ainda não lhe foi pago, ao preço dela
 * (`payRate`) ou pelo valor das horas, ou pelo `amount` dado.
 */
export class CreateTimeTrackingPayoutDto {
  @ValidateIf((dto: CreateTimeTrackingPayoutDto) => !dto.entryIds)
  @IsUUID()
  personId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ENTRY_IDS)
  @IsUUID('all', { each: true })
  entryIds?: string[];

  @ValidateIf((dto: CreateTimeTrackingPayoutDto) => !dto.entryIds)
  @Matches(DAY)
  fromDate?: string;

  @ValidateIf((dto: CreateTimeTrackingPayoutDto) => !dto.entryIds)
  @Matches(DAY)
  toDate?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  withholdingPct?: number | null;

  @Matches(DAY)
  paidAt: string;

  // Grava também o pagamento na empresa, desta conta
  @IsOptional()
  @IsUUID()
  fromBankAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tz?: string;
}

export class PayoutsQueryDto {
  @IsOptional()
  @IsUUID()
  personId?: string;
}

export class SettlementsQueryDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  personId?: string;
}
