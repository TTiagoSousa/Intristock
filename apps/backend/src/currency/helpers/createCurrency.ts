import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaCurrencyRepository } from '../repositories/prisma/prisma-currency-repository';
import { CreateCurrencyDto } from '../dto/create-currency.dto';
import { CurrencyApiConfig, fetchCurrencyByShortCode, fetchLatestRates } from './currencyBeaconClient';

export async function createCurrency(
  dto: CreateCurrencyDto,
  currencyRepository: PrismaCurrencyRepository,
  api: CurrencyApiConfig,
) {
  const shortCode = dto.shortCode.toUpperCase();

  const exists = await currencyRepository.findByShortCode(shortCode);
  if (exists) throw new ConflictException('Currency already exists');

  const [currencyDetails, rates] = await Promise.all([fetchCurrencyByShortCode(api, shortCode), fetchLatestRates(api)]);

  if (!currencyDetails) throw new NotFoundException('Currency code not found');

  return currencyRepository.create({
    name: currencyDetails.name,
    shortCode: currencyDetails.short_code,
    code: currencyDetails.code,
    precision: currencyDetails.precision,
    subunit: currencyDetails.subunit,
    symbol: currencyDetails.symbol,
    symbolFirst: currencyDetails.symbol_first,
    decimalMark: currencyDetails.decimal_mark,
    thousandsSeparator: currencyDetails.thousands_separator,
    rate: rates[shortCode] ?? 0,
  });
}
