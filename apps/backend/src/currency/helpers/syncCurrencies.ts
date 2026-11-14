import { PrismaCurrencyRepository } from '../repositories/prisma/prisma-currency-repository';
import { CurrencyApiConfig, fetchAllCurrencies, fetchLatestRates } from './currencyBeaconClient';

export async function syncCurrencies(currencyRepository: PrismaCurrencyRepository, api: CurrencyApiConfig) {
  const [currencies, rates] = await Promise.all([fetchAllCurrencies(api), fetchLatestRates(api)]);

  for (const currency of currencies) {
    await currencyRepository.upsert({
      name: currency.name,
      shortCode: currency.short_code,
      code: currency.code,
      precision: currency.precision,
      subunit: currency.subunit,
      symbol: currency.symbol,
      symbolFirst: currency.symbol_first,
      decimalMark: currency.decimal_mark,
      thousandsSeparator: currency.thousands_separator,
      rate: rates[currency.short_code] ?? 0,
    });
  }

  return { synced: currencies.length };
}
