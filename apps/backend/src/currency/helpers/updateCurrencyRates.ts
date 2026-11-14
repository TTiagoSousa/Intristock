import { PrismaCurrencyRepository } from '../repositories/prisma/prisma-currency-repository';
import { CurrencyApiConfig, fetchLatestRates } from './currencyBeaconClient';

export async function updateCurrencyRates(currencyRepository: PrismaCurrencyRepository, api: CurrencyApiConfig) {
  const currencies = await currencyRepository.findAll();
  if (currencies.length === 0) return { updated: 0 };

  const rates = await fetchLatestRates(api);

  await Promise.all(
    currencies.map((currency) => currencyRepository.updateRate(currency.id, rates[currency.shortCode] ?? currency.rate)),
  );

  return { updated: currencies.length };
}
