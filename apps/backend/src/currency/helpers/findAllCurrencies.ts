import { PrismaCurrencyRepository } from '../repositories/prisma/prisma-currency-repository';

// Por agora o euro, o dólar, a libra e o real: são as que têm cotação de hora a hora
// (`CurrencyHourRate`). As outras ficam na base (os registos que já as usam
// continuam a mostrá-las), mas não se escolhem
export const AVAILABLE_CURRENCIES = ['EUR', 'USD', 'GBP', 'BRL'];

export async function findAllCurrencies(
  currencyRepository: PrismaCurrencyRepository,
) {
  const currencies = await currencyRepository.findAll();
  return currencies.filter((currency) =>
    AVAILABLE_CURRENCIES.includes(currency.shortCode),
  );
}
