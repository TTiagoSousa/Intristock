import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CONDITIONS, type Condition } from '../helpers/valuationReport';

// Por agora só motas; os carros e o resto entram aqui
export const VEHICLE_TYPES = ['motorcycle'] as const;
export const ACQUISITIONS = ['purchase', 'gift', 'inheritance', 'other'] as const;
// De onde vem (ou para onde vai) o dinheiro: novo, de um portefólio, ou nenhum (oferta, sem registo)
export const GOODS_CASH_MODES = ['new', 'portfolio', 'none'] as const;
// De quantos em quantos dias o valor se atualiza sozinho
export const VALUATION_INTERVALS = [7, 30, 90] as const;

/** A mota: o que a identifica e como se pesquisa o preço dela. */
export class GoodsDetailsDto {
  @IsIn(VEHICLE_TYPES)
  vehicleType: (typeof VEHICLE_TYPES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  brand: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  model: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  version?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1885)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  plate?: string;

  // A pesquisa de preços: por omissão a marca e o modelo
  @IsOptional()
  @IsString()
  @MaxLength(80)
  searchQuery?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(500)
  radiusKm?: number;
}

/**
 * Um valor: à mão (`manualValue`) ou pelo relatório de uma pesquisa (o que veio de
 * `POST /goods/prices`, com os anúncios que a pessoa tirou ou repôs) e o estado escolhido.
 */
export class GoodsValuationDto {
  @IsOptional()
  @IsObject()
  report?: Record<string, unknown>;

  @IsOptional()
  @IsIn(CONDITIONS)
  condition?: Condition;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  manualValue?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  excludedIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  includedIds?: string[];
}

/** Registar uma mota num portefólio: os dados, como se obteve, o preço (opcional) e o valor de agora (opcional). */
export class CreateGoodsDto {
  @IsUUID()
  portfolioId: string;

  @ValidateNested()
  @Type(() => GoodsDetailsDto)
  details: GoodsDetailsDto;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsDateString()
  date: string;

  @IsIn(ACQUISITIONS)
  acquisition: (typeof ACQUISITIONS)[number];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number | null;

  @IsUUID()
  currencyId: string;

  @IsIn(GOODS_CASH_MODES)
  cash: (typeof GOODS_CASH_MODES)[number];

  @IsOptional()
  @IsUUID()
  cashPortfolioId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GoodsValuationDto)
  valuation?: GoodsValuationDto;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(VALUATION_INTERVALS)
  valuationEveryDays?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Uma avaliação nova (à mão ou pela pesquisa). */
export class AddGoodsValuationDto extends GoodsValuationDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Vender: o preço escrito à mão e para onde vai o dinheiro. */
export class SellGoodsDto {
  @IsDateString()
  date: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsIn(GOODS_CASH_MODES)
  cash: (typeof GOODS_CASH_MODES)[number];

  @IsOptional()
  @IsUUID()
  cashPortfolioId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Mudar os dados, a pesquisa ou a atualização automática. */
export class UpdateGoodsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GoodsDetailsDto)
  details?: GoodsDetailsDto;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(VALUATION_INTERVALS)
  valuationEveryDays?: number | null;
}

/** Pesquisar preços (2 pesquisas da SerpApi): o que se procura, onde e num raio. */
export class GoodsPricesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  query: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  location: string;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(500)
  radiusKm: number;
}

export class GoodsLocationsQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  q: string;
}
