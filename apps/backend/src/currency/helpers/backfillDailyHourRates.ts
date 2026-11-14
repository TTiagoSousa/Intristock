import { PrismaCurrencyRepository } from '../repositories/prisma/prisma-currency-repository';
import { PrismaCurrencyHourRateRepository } from '../repositories/prisma/prisma-currency-hour-rate-repository';
import {
  CurrencyApiConfig,
  fetchHistoricalRates,
} from './currencyBeaconClient';
import { AVAILABLE_CURRENCIES } from './findAllCurrencies';

// Quantos dias se pedem numa volta (os outros ficam para a seguinte)
const MAX_DAYS_PER_RUN = 60;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Enche o passado da `CurrencyHourRate` desde o dia da primeira transação de um
 * portefólio até ontem. A CurrencyBeacon não tem horas para trás, só o
 * `historical` de cada dia: entra uma linha por dia, à meia-noite UTC. Um dia
 * que já tem alguma hora não se pede. Devolve quantos dias gravou.
 */
export async function backfillDailyHourRates(
  currencyRepository: PrismaCurrencyRepository,
  hourRateRepository: PrismaCurrencyHourRateRepository,
  apiConfig: () => Promise<CurrencyApiConfig>,
) {
  const first = await hourRateRepository.firstPortfolioDay();
  if (!first) return 0;

  const today = new Date(`${isoDay(new Date())}T00:00:00.000Z`);
  const start = new Date(`${isoDay(first)}T00:00:00.000Z`);
  if (start >= today) return 0;

  const have = await hourRateRepository.daysWithRates(start, today);
  const missing: string[] = [];
  for (
    const day = new Date(start);
    day < today;
    day.setUTCDate(day.getUTCDate() + 1)
  )
    if (!have.has(isoDay(day))) missing.push(isoDay(day));
  if (!missing.length) return 0;

  const currencies = (
    await Promise.all(
      AVAILABLE_CURRENCIES.map((code) =>
        currencyRepository.findByShortCode(code),
      ),
    )
  ).filter((currency) => currency !== null);
  const symbols = AVAILABLE_CURRENCIES.filter((code) => code !== 'USD');
  const config = await apiConfig();

  let saved = 0;
  for (const day of missing.slice(0, MAX_DAYS_PER_RUN)) {
    const quoted = await fetchHistoricalRates(config, 'USD', symbols, day);
    const rows = currencies
      .map((currency) => ({
        currencyId: currency.id,
        rate: currency.shortCode === 'USD' ? 1 : quoted[currency.shortCode],
      }))
      .filter((row) => row.rate && Number.isFinite(row.rate) && row.rate > 0);
    if (rows.length < currencies.length) continue;
    await hourRateRepository.saveHour(new Date(`${day}T00:00:00.000Z`), rows);
    saved += 1;
  }
  return saved;
}
