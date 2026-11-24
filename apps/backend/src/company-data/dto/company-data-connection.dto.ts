import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, ValidateIf, IsArray, ArrayMaxSize } from 'class-validator';
import { CONNECTION_SYNC_HOURS, DATA_CONNECTION_PROVIDERS } from '../helpers/connections/saveDataConnection';

export class CheckDataConnectionDto {
  @IsIn(DATA_CONNECTION_PROVIDERS)
  provider: (typeof DATA_CONNECTION_PROVIDERS)[number];

  /// A loja (a-tua-loja.myshopify.com)
  @IsString()
  @MaxLength(120)
  shop: string;

  /// A chave da app da loja (Admin API access token)
  @IsString()
  @MaxLength(300)
  token: string;
}

export class CreateDataConnectionDto extends CheckDataConnectionDto {
  /// Uma tabela que já existe (com chave) ou, sem ela, uma nova com o nome e os campos escolhidos
  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  newTableName?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  fields?: string[];

  /// Campo da API → coluna da tabela (numa tabela que já existe)
  @IsOptional()
  @IsObject()
  mapping?: Record<string, string>;

  @IsOptional()
  @IsIn(CONNECTION_SYNC_HOURS)
  syncEveryHours?: (typeof CONNECTION_SYNC_HOURS)[number];
}

export class UpdateDataConnectionDto {
  @IsOptional()
  @IsIn(['active', 'paused'])
  status?: 'active' | 'paused';

  @IsOptional()
  @IsIn(CONNECTION_SYNC_HOURS)
  syncEveryHours?: (typeof CONNECTION_SYNC_HOURS)[number];

  @IsOptional()
  @IsObject()
  mapping?: Record<string, string>;

  /// Uma chave nova (vê-se na loja antes de gravar)
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(300)
  token?: string;
}
