import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator';
import { COUNTRY_PROVIDERS, CURRENCY_PROVIDERS, PROPFIRM_PROVIDERS } from '../helpers/apiProviders';

const URL_OPTIONS = { protocols: ['https', 'http'], require_protocol: true, require_tld: false };

class CurrencyApiSettingDto {
  @IsIn(CURRENCY_PROVIDERS.map((p) => p.id))
  provider: string;

  @IsUrl(URL_OPTIONS)
  url: string;

  // Em branco mantém a chave que já estava guardada
  @IsOptional()
  @IsString()
  key?: string;
}

class CountryApiSettingDto {
  @IsIn(COUNTRY_PROVIDERS.map((p) => p.id))
  provider: string;

  @IsUrl(URL_OPTIONS)
  url: string;

  @IsOptional()
  @IsString()
  key?: string;
}

class PropfirmApiSettingDto {
  @IsIn(PROPFIRM_PROVIDERS.map((p) => p.id))
  provider: string;

  @IsUrl(URL_OPTIONS)
  url: string;

  @IsOptional()
  @IsString()
  key?: string;
}

export class SaveApiSettingsDto {
  @ValidateNested()
  @Type(() => CurrencyApiSettingDto)
  currency: CurrencyApiSettingDto;

  @ValidateNested()
  @Type(() => CountryApiSettingDto)
  country: CountryApiSettingDto;

  // Opcional: o assistente da instalação não a manda
  @IsOptional()
  @ValidateNested()
  @Type(() => PropfirmApiSettingDto)
  propfirm?: PropfirmApiSettingDto;
}
