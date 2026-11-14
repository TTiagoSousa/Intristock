import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

// purchase: uma compra · company: dinheiro posto numa empresa · other: o resto
export const EXPENSE_KINDS = ['purchase', 'company', 'other'] as const;
// As de uma subscrição gravam-se ao marcar um período como pago, não à mão
export const EXPENSE_FILTER_KINDS = [...EXPENSE_KINDS, 'subscription'] as const;
export const EXPENSE_STATUSES = ['paid', 'pending'] as const;
export const MAX_EXPENSE_ITEMS = 200;

export class ExpenseItemDto {
  // Um produto do catálogo; sem ele, procura-se pelo nome ou cria-se
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice: number;
}

/**
 * Uma despesa. Com linhas, o valor é a soma delas; sem elas, o `amount`. Uma
 * de `company` leva a empresa e a conta dela onde o dinheiro entra
 * (`companyBankAccountId`): cria lá o recebimento do sócio.
 */
export class CreatePersonalExpenseDto {
  @IsIn(EXPENSE_KINDS)
  kind: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  merchant?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  description?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  companyBankAccountId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount?: number;

  @IsUUID()
  currencyId: string;

  @IsOptional()
  @IsIn(EXPENSE_STATUSES)
  status?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  bankAccountId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_EXPENSE_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => ExpenseItemDto)
  items?: ExpenseItemDto[];
}

// O tipo e a empresa não mudam (o recebimento na empresa fica como foi feito)
export class UpdatePersonalExpenseDto extends PartialType(
  OmitType(CreatePersonalExpenseDto, [
    'kind',
    'companyId',
    'companyBankAccountId',
  ] as const),
) {}

export class CreateExpenseCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  // Dentro de qualquer outra (sem limite de níveis)
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateExpenseCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Mudar de sítio na árvore (nulo = passa a principal)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  parentId?: string | null;
}

// Uma categoria de item, dentro de qualquer outra (sem limite de níveis)
export class CreateItemCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateItemCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Mudar de sítio na árvore (nulo = passa a principal)
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  parentId?: string | null;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  brand?: string | null;

  // kg, l, un…
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(20)
  unit?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  categoryId?: string | null;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ProductsQueryDto {
  // A moeda dos totais (as outras pelo `Currency.rate`)
  @IsOptional()
  @IsUUID()
  currencyId?: string;
}

export class ExpensesQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(EXPENSE_FILTER_KINDS)
  kind?: string;

  // Uma categoria (com as subcategorias dela) ou uma subcategoria
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  // Procura na loja, na descrição e nos produtos
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}

// Um intervalo escolhido à mão no resumo não passa disto
export const MAX_EXPENSE_RANGE_MONTHS = 60;

export class ExpenseSummaryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  months?: number;

  // Um intervalo à mão para o gráfico e as somas (categorias, itens, lojas, produtos),
  // `YYYY-MM` a `YYYY-MM` (os dois inclusive): os cartões não mudam
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  to?: string;

  @IsOptional()
  @IsUUID()
  currencyId?: string;
}
