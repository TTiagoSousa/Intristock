import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { VIEW_FILTERS } from 'src/company-data/helpers/pageJoinedRows';
import { LEAD_SOURCE_TYPES, MAX_BULK, MAX_CALLBACK_NOTE, MAX_CARD_LIMIT, MAX_COMMENT } from '../helpers/leadTypes';
import { BULK_ACTIONS } from '../helpers/bulkLeads';
import { LEAD_RULE_ACTIONS } from '../helpers/leadRules';

// As colunas, os filtros e o cartão validam-se no helper (assertBoardSettings), contra a origem

class LeadBoardSettingsDto {
  @IsOptional()
  @IsArray()
  filters?: unknown[];

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(120)
  search?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIn(VIEW_FILTERS)
  only?: (typeof VIEW_FILTERS)[number] | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(80)
  phoneColumn?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(80)
  titleColumn?: string | null;

  @IsOptional()
  @IsArray()
  cardColumns?: unknown[];
}

export class CreateLeadBoardDto extends LeadBoardSettingsDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsIn(LEAD_SOURCE_TYPES)
  sourceType: (typeof LEAD_SOURCE_TYPES)[number];

  @IsUUID()
  sourceId: string;
}

export class UpdateLeadBoardDto extends LeadBoardSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsIn(LEAD_SOURCE_TYPES)
  sourceType?: (typeof LEAD_SOURCE_TYPES)[number];

  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class CreateLeadStageDto {
  @IsString()
  @MaxLength(60)
  name: string;
}

export class UpdateLeadStageDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  /// O lugar no quadro (0 = a primeira)
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  /// Quantos cartões se mostram de início (nulo = todos)
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(MAX_CARD_LIMIT)
  cardLimit?: number | null;
}

class LeadRuleBaseDto {
  /// Condições sobre a própria lead: [{ field, op, value }] (validam-se no helper)
  @IsOptional()
  @IsArray()
  leadConditions?: unknown[];

  /// No «assign»: a quem, pela ordem
  @IsOptional()
  @IsArray()
  assigneeIds?: unknown[];

  /// As condições, como os filtros: [{ column, op, value | values }] (validam-se contra a origem)
  @IsOptional()
  @IsArray()
  conditions?: unknown[];

  /// Só quando a lead está numa destas colunas (vazio = em qualquer uma)
  @IsOptional()
  @IsArray()
  fromStageIds?: unknown[];

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  stageId?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class CreateLeadRuleDto extends LeadRuleBaseDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsIn(LEAD_RULE_ACTIONS)
  action: (typeof LEAD_RULE_ACTIONS)[number];
}

export class UpdateLeadRuleDto extends LeadRuleBaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsIn(LEAD_RULE_ACTIONS)
  action?: (typeof LEAD_RULE_ACTIONS)[number];

  /// O lugar na lista (0 = a primeira)
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class LeadBoardQueryDto {
  /// Com as arquivadas (marcadas), para as repor
  @IsOptional()
  @IsIn(['true', 'false'])
  archived?: 'true' | 'false';

  /// Com as que deixaram de passar os filtros (marcadas)
  @IsOptional()
  @IsIn(['true', 'false'])
  left?: 'true' | 'false';
}

/** Que lead: a linha da origem (a chave, o id ou, numa unida, «A|B»). */
export class LeadRowQueryDto {
  @IsString()
  @MaxLength(200)
  row: string;
}

class LeadRowDto {
  @IsString()
  @MaxLength(200)
  rowKey: string;

  /// A posição que o cartão tinha no ecrã (para uma lead nova não mudar de lugar)
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  position?: number;
}

export class MoveLeadDto {
  @IsString()
  @MaxLength(200)
  rowKey: string;

  @IsUUID()
  stageId: string;

  /// O lugar na coluna: um número entre o do cartão de cima e o de baixo
  @Type(() => Number)
  @IsNumber()
  position: number;

  /// A posição que o cartão tinha antes (para uma lead nova)
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  from?: number;
}

export class AddLeadCommentDto extends LeadRowDto {
  @IsString()
  @MaxLength(MAX_COMMENT)
  body: string;
}

export class EditLeadCommentDto {
  @IsString()
  @MaxLength(MAX_COMMENT)
  body: string;
}

export class ArchiveLeadDto extends LeadRowDto {
  @IsBoolean()
  archived: boolean;
}

export class AssignLeadDto extends LeadRowDto {
  /// Nulo tira a lead a quem a tinha
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  assignedToId: string | null;
}

export class LeadCallbackDto extends LeadRowDto {
  /// ISO; nulo tira
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(40)
  callbackAt: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(MAX_CALLBACK_NOTE)
  note?: string | null;
}

export class LogLeadCallDto extends LeadRowDto {
  @IsUUID()
  outcomeId: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(40)
  callbackAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(MAX_CALLBACK_NOTE)
  callbackNote?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(MAX_COMMENT)
  comment?: string | null;
}

class BulkRowDto extends LeadRowDto {}

export class BulkLeadsDto {
  @IsArray()
  @ArrayMaxSize(MAX_BULK)
  @ValidateNested({ each: true })
  @Type(() => BulkRowDto)
  rows: BulkRowDto[];

  @IsIn(BULK_ACTIONS)
  action: (typeof BULK_ACTIONS)[number];

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  stageId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  assignedToId?: string | null;
}

class LeadOutcomeBaseDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  stageId?: string | null;

  @IsOptional()
  @IsBoolean()
  answered?: boolean;

  @IsOptional()
  @IsBoolean()
  countsAsAttempt?: boolean;

  @IsOptional()
  @IsBoolean()
  asksCallback?: boolean;
}

export class CreateLeadOutcomeDto extends LeadOutcomeBaseDto {
  @IsString()
  @MaxLength(40)
  name: string;
}

export class UpdateLeadOutcomeDto extends LeadOutcomeBaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class LeadDashboardQueryDto {
  /// ISO; sem ele, os últimos 30 dias até ao `to`
  @IsOptional()
  @IsString()
  @MaxLength(40)
  from?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  to?: string;

  @IsOptional()
  @IsUUID()
  boardId?: string;

  /// O fuso do browser, para os dias
  @IsOptional()
  @IsString()
  @MaxLength(60)
  tz?: string;
}

export class RowCommentsQueryDto {
  @IsIn(LEAD_SOURCE_TYPES)
  sourceType: (typeof LEAD_SOURCE_TYPES)[number];

  @IsUUID()
  sourceId: string;
}

export class RowCommentsListQueryDto extends RowCommentsQueryDto {
  @IsString()
  @MaxLength(200)
  row: string;
}
