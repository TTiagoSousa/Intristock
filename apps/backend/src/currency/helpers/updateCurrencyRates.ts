import { PrismaCurrencyRepository } from '../repositories/prisma/prisma-currency-repository';
import { CurrencyApiConfig, fetchLatestRates } from './currencyBeaconClient';

/**
 * O `Currency.rate` de todas as moedas do catálogo (base USD). Com `rates` já
 * pedidos (a volta de hora a hora) não vai à API.
 */
export async function updateCurrencyRates(
  currencyRepository: PrismaCurrencyRepository,
  api: CurrencyApiConfig | null,
  quoted?: Record<string, number>,
) {
  const currencies = await currencyRepository.findAll();
  if (currencies.length === 0) return { updated: 0 };

  const rates = quoted ?? (await fetchLatestRates(api!));

  // Num só pedido à base; as que a API não traz ficam como estão
  const quotedRates = currencies.flatMap((currency) =>
    rates[currency.shortCode] !== undefined ? [{ id: currency.id, rate: rates[currency.shortCode] }] : [],
  );
  await currencyRepository.updateRates(quotedRates);

  return { updated: quotedRates.length };
}
