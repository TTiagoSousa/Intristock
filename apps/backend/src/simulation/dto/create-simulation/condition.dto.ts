// As condições (e os grupos)
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  OPERATORS,
} from './constants';
import {
  OperandDto,
} from './operand.dto';

// Como se juntam as condições: todas (E) ou qualquer uma (OU)
export const CONDITION_MATCHES = ['all', 'any'] as const;

// Uma condição ao longo do tempo: nalguma (any) ou em todas (all) as últimas N velas
export const WITHIN_MODES = ['any', 'all'] as const;
export const MAX_WITHIN = 200;

export class WithinDto {
  @IsInt()
  @Min(2)
  @Max(MAX_WITHIN)
  bars: number;

  @IsIn(WITHIN_MODES)
  mode: (typeof WITHIN_MODES)[number];
}

// Um grupo é uma condição com `conditions` (e `match`) em vez dos dois lados
export const isGroup = (condition: ConditionDto) => !!condition.conditions;

/**
 * Uma condição — [valor] comparação [valor] — ou um grupo de condições juntas
 * entre si (todas ou qualquer uma), que conta como uma só: "(A e B) ou (C e D)".
 * Num grupo não há outros grupos (o backend recusa-os) e os lados ficam vazios.
 */
export class ConditionDto {
  @ValidateIf((condition: ConditionDto) => !isGroup(condition))
  @ValidateNested()
  @Type(() => OperandDto)
  left: OperandDto;

  @ValidateIf((condition: ConditionDto) => !isGroup(condition))
  @IsIn(OPERATORS)
  operator: (typeof OPERATORS)[number];

  @ValidateIf((condition: ConditionDto) => !isGroup(condition))
  @ValidateNested()
  @Type(() => OperandDto)
  right: OperandDto;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions?: ConditionDto[];

  // Num grupo: todas (por omissão) ou qualquer uma
  @IsOptional()
  @IsIn(CONDITION_MATCHES)
  match?: (typeof CONDITION_MATCHES)[number];

  // Nalguma ou em todas as últimas N velas (a atual incluída); sem ele, só agora
  @IsOptional()
  @ValidateNested()
  @Type(() => WithinDto)
  within?: WithinDto | null;

  // Em "entre": o outro limite (o RSI entre 30 e 70); a ordem dos dois não conta
  @ValidateIf((condition: ConditionDto) => condition.operator === 'between')
  @ValidateNested()
  @Type(() => OperandDto)
  rightTo?: OperandDto;

  // O lado direito ± uma %: "fecho acima da MME50 + 1%" (−50 a 100)
  @IsOptional()
  @IsNumber()
  @Min(-50)
  @Max(100)
  rightPct?: number | null;
}
