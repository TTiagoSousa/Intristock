import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { API_KEY_KINDS, type ApiKeyKind } from '../helpers/apiKeyProviders';

export class ApiKeyKindQueryDto {
  @IsIn(API_KEY_KINDS)
  kind: ApiKeyKind;
}

/** Uma chave nova: validada na API antes de se gravar. */
export class CreateApiKeyDto {
  @IsIn(API_KEY_KINDS)
  kind: ApiKeyKind;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  key: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;
}

export class UpdateApiKeyDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ReorderApiKeysDto {
  @IsIn(API_KEY_KINDS)
  kind: ApiKeyKind;

  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  ids: string[];
}
