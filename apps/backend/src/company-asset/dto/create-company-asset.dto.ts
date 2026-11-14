import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

// Categorias do imobilizado. A taxa de amortização que se aplica a cada uma
// vem da tabela legal — não está aqui, é escrita a cada ativo, porque depende
// do país e do caso concreto.
export const ASSET_CATEGORIES = [
  'equipamento_basico',
  'equipamento_informatico',
  'equipamento_administrativo',
  'mobiliario',
  'viaturas',
  'edificios',
  'intangivel',
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const ASSET_STATUSES = ['em_uso', 'manutencao', 'abatido', 'vendido'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export class CreateCompanyAssetDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsIn(ASSET_CATEGORIES)
  category: AssetCategory;

  @IsDateString()
  acquisitionDate: string;

  // Sem imposto: o IVA dedutível não é custo, logo não faz parte do valor do
  // ativo. Quem não deduz IVA regista aqui o total.
  @IsNumber()
  @Min(0)
  acquisitionValue: number;

  // Como nos pagamentos: a empresa trabalha só na moeda dela, por isso isto
  // vem fixo e não precisa de vir no body.
  @IsOptional()
  @IsUUID()
  currencyId?: string;

  // Percentagem ao ano, para a contabilidade
  @IsNumber()
  @Min(0)
  @Max(100)
  depreciationRate: number;

  // Horas de vida útil, para o custo por hora de máquina. É outra coisa: a
  // taxa anual serve a contabilidade, as horas servem o custeio.
  @IsOptional()
  @IsInt()
  @Min(1)
  usefulLifeHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  residualValue?: number;

  // A compra que trouxe o ativo. Opcional: pode registar-se um ativo que já
  // se tinha antes de abrir a empresa.
  @IsOptional()
  @IsUUID()
  paymentId?: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
