import { PrismaCurrencyRepository } from '../repositories/prisma/prisma-currency-repository';
import { PrismaCurrencyHourRateRepository } from '../repositories/prisma/prisma-currency-hour-rate-repository';
import { CurrencyApiConfig, fetchLatestRates } from './currencyBeaconClient';
import { AVAILABLE_CURRENCIES } from './findAllCurrencies';

/** A hora certa em que estamos, em UTC (14:37 → 14:00). */
export const currentHour = (now = new Date()) => {
  const hour = new Date(now);
  hour.setUTCMinutes(0, 0, 0);
  return hour;
};

/**
 * Guarda as cotações desta hora das moedas do site (um pedido `latest` à
 * CurrencyBeacon, base USD). Se a hora já está guardada, não pede nada.
 * Devolve se gravou.
 */
export async function saveCurrentHourRates(
  currencyRepository: PrismaCurrencyRepository,
  hourRateRepository: PrismaCurrencyHourRateRepository,
  apiConfig: () => Promise<CurrencyApiConfig>,
) {
  const hour = currentHour();
  if (await hourRateRepository.hasHour(hour)) return false;

  const quoted = await fetchLatestRates(
    await apiConfig(),
    AVAILABLE_CURRENCIES,
  );
  const rows: { currencyId: string; rate: number }[] = [];
  for (const code of AVAILABLE_CURRENCIES) {
    const currency = await currencyRepository.findByShortCode(code);
    // 1 USD = 1 USD: a base também entra, para as contas serem iguais em todas
    const rate = code === 'USD' ? 1 : quoted[code];
    if (currency && rate && Number.isFinite(rate) && rate > 0)
      rows.push({ currencyId: currency.id, rate });
  }
  if (!rows.length) return false;
  await hourRateRepository.saveHour(hour, rows);
  return true;
}
