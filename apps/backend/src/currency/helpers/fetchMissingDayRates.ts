import { PrismaCurrencyRateRepository } from '../repositories/prisma/prisma-currency-rate-repository';
import { CurrencyApiConfig, fetchHistoricalRates } from './currencyBeaconClient';

export type MissingDayRates = {
  day: string; // YYYY-MM-DD
  target: { id: string; shortCode: string };
  currencies: { id: string; shortCode: string }[];
};

// Quantos dias se pedem à API ao mesmo tempo
const FETCH_CONCURRENCY = 6;

/**
 * Vai buscar à CurrencyBeacon as cotações que faltam na `CurrencyRate` (um pedido por dia com
 * todas as moedas desse dia) e guarda-as de uma vez no fim (`createMany`, sem repetir as que já
 * lá estão). Corre fora dos pedidos (a fila do `CurrencyRateFillService`): quem lê usa o que já
 * está guardado e a estimativa. Com a API por configurar ou em baixo, para à primeira falha.
 */
export async function fetchMissingDayRates(
  batch: MissingDayRates[],
  rateRepository: PrismaCurrencyRateRepository,
  apiConfig: () => Promise<CurrencyApiConfig>,
) {
  const rows: { date: Date; baseCurrencyId: string; quoteCurrencyId: string; rate: number }[] = [];
  let config: CurrencyApiConfig | null = null;
  let apiDown = false;

  const fetchDay = async ({ day, target, currencies }: MissingDayRates) => {
    if (apiDown) return;
    try {
      config ??= await apiConfig();
      // 1 `target` = X de cada uma: guarda-se o contrário, 1 dela em `target`
      const quoted = await fetchHistoricalRates(
        config,
        target.shortCode,
        currencies.map((currency) => currency.shortCode),
        day,
      );
      for (const currency of currencies) {
        const value = quoted[currency.shortCode];
        if (!value || !Number.isFinite(value) || value <= 0) continue;
        rows.push({
          date: new Date(`${day}T00:00:00.000Z`),
          baseCurrencyId: currency.id,
          quoteCurrencyId: target.id,
          rate: 1 / value,
        });
      }
    } catch {
      apiDown = true;
    }
  };

  for (let index = 0; index < batch.length; index += FETCH_CONCURRENCY)
    await Promise.all(batch.slice(index, index + FETCH_CONCURRENCY).map(fetchDay));

  await rateRepository.saveMany(rows);
  return { saved: rows.length, apiDown };
}
