import { PrismaCurrencyRateRepository } from '../repositories/prisma/prisma-currency-rate-repository';
import { PrismaCurrencyHourRateRepository } from '../repositories/prisma/prisma-currency-hour-rate-repository';
import {
  CurrencyApiConfig,
  fetchHistoricalRates,
} from './currencyBeaconClient';

/** O que o conversor precisa de cada moeda: o id, o código e a cotação de referência. */
export type ConvertibleCurrency = {
  id: string;
  shortCode: string;
  rate: number;
};

/**
 * Um valor a converter: a moeda e o dia ('YYYY-MM-DD'; sem ele, ou no futuro, hoje).
 * Com `hour` (o `rateHour` de um registo), pela cotação dessa hora, sem ir à API.
 */
export type ConversionNeed = {
  currency: ConvertibleCurrency;
  day?: string | null;
  hour?: Date | null;
};

export type Converter = {
  convert: (
    amount: number,
    currency: ConvertibleCurrency,
    day?: string | null,
    // A hora das cotações do registo, se a tiver
    hour?: Date | null,
  ) => number;
  // Quantos dias (de uma moeda) foram pela cotação de referência por não haver a do dia
  estimated: () => number;
};

// Os dias que se pedem à API num pedido (os outros ficam para a vez seguinte) e quantos ao mesmo tempo
const MAX_FETCH_DAYS = 60;
const FETCH_CONCURRENCY = 6;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Converte valores para `target` pela cotação do dia de cada um (um dia futuro
 * usa a de hoje): as da `CurrencyRate` e, as que faltam, um pedido à API por
 * dia com todas as moedas desse dia, que ficam guardadas. Sem a do dia (API em
 * baixo, por configurar, mais de `MAX_FETCH_DAYS` dias novos) vai pelo
 * `Currency.rate`, e `estimated` conta-os.
 */
export async function buildConverter(
  target: ConvertibleCurrency | null,
  needs: ConversionNeed[],
  rateRepository: PrismaCurrencyRateRepository,
  hourRateRepository: PrismaCurrencyHourRateRepository,
  // Só se lê a configuração da API quando é mesmo preciso chamá-la
  apiConfig: () => Promise<CurrencyApiConfig>,
): Promise<Converter> {
  const today = isoDay(new Date());
  const dayOf = (day?: string | null) =>
    day && day.slice(0, 10) < today ? day.slice(0, 10) : today;
  const rates = new Map<string, number>(); // `${dia}|${moeda}` → 1 moeda em `target`
  const estimated = new Set<string>();

  const fallback = (amount: number, currency: ConvertibleCurrency) =>
    target && currency.rate ? (amount * target.rate) / currency.rate : amount;

  // As cotações de hora a hora (unidades por 1 USD): as horas dos registos e a
  // mais recente, que serve para hoje e para o que está à frente
  const hourly = new Map<string, number>(); // `${hora ISO}|${moeda}` → rate
  let latest: Date | null = null;
  const hourRate = (
    amount: number,
    currency: ConvertibleCurrency,
    hour: Date | null | undefined,
  ) => {
    if (!target || !hour) return null;
    const from = hourly.get(`${hour.toISOString()}|${currency.id}`);
    const to = hourly.get(`${hour.toISOString()}|${target.id}`);
    return from && to ? (amount / from) * to : null;
  };
  // A última hora guardada de cada dia passado (para os valores sem hora própria)
  const lastOfDay = new Map<string, Date>();
  // A hora que vale para um valor: a dele, hoje e à frente a mais recente, num
  // dia passado a última desse dia (os dias de antes da tarefa têm uma, a do
  // `historical`, à meia-noite)
  const hourFor = (day?: string | null, hour?: Date | null) =>
    hour ??
    (dayOf(day) === today ? latest : (lastOfDay.get(dayOf(day)) ?? null));

  if (target) {
    latest = await hourRateRepository.latestHour();
    const currencyIds = [
      ...new Set([target.id, ...needs.map((need) => need.currency.id)]),
    ];
    const keep = (row: { hour: Date; currencyId: string; rate: unknown }) =>
      hourly.set(
        `${row.hour.toISOString()}|${row.currencyId}`,
        Number(row.rate),
      );

    const hours = new Map<string, Date>();
    for (const need of needs)
      if (need.hour) hours.set(need.hour.toISOString(), need.hour);
    if (latest) hours.set(latest.toISOString(), latest);
    for (const row of await hourRateRepository.findMany(
      [...hours.values()],
      currencyIds,
    ))
      keep(row);

    // Os dias passados dos valores sem hora: todas as horas desses dias, de uma vez
    const days = [
      ...new Set(
        needs
          .filter((need) => !need.hour)
          .map((need) => dayOf(need.day))
          .filter((day) => day !== today),
      ),
    ].sort();
    if (days.length) {
      const wantedDays = new Set(days);
      const until = new Date(`${days[days.length - 1]}T00:00:00.000Z`);
      until.setUTCDate(until.getUTCDate() + 1);
      for (const row of await hourRateRepository.findBetween(
        new Date(`${days[0]}T00:00:00.000Z`),
        until,
        currencyIds,
      )) {
        const day = isoDay(row.hour);
        if (!wantedDays.has(day)) continue;
        keep(row);
        const last = lastOfDay.get(day);
        if (!last || row.hour > last) lastOfDay.set(day, row.hour);
      }
    }
  }

  if (target) {
    // Os dias e as moedas que faltam (os que a hora já resolve não vão à API)
    const wanted = new Map<string, Map<string, ConvertibleCurrency>>();
    for (const need of needs) {
      if (need.currency.id === target.id) continue;
      if (hourRate(1, need.currency, hourFor(need.day, need.hour)) !== null)
        continue;
      const day = dayOf(need.day);
      const currencies =
        wanted.get(day) ?? new Map<string, ConvertibleCurrency>();
      currencies.set(need.currency.id, need.currency);
      wanted.set(day, currencies);
    }

    if (wanted.size) {
      const currencyIds = [
        ...new Set(
          [...wanted.values()].flatMap((currencies) => [...currencies.keys()]),
        ),
      ];
      const stored = await rateRepository.findMany(
        [...wanted.keys()].map((day) => new Date(`${day}T00:00:00.000Z`)),
        currencyIds,
        target.id,
      );
      for (const row of stored)
        rates.set(
          `${isoDay(row.date)}|${row.baseCurrencyId}`,
          Number(row.rate),
        );

      // Os dias com moedas sem cotação, dos mais recentes (os que mais se veem)
      const missing = [...wanted.entries()]
        .map(
          ([day, currencies]) =>
            [
              day,
              [...currencies.values()].filter(
                (currency) => !rates.has(`${day}|${currency.id}`),
              ),
            ] as const,
        )
        .filter(([, currencies]) => currencies.length)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, MAX_FETCH_DAYS);

      let config: CurrencyApiConfig | null = null;
      let apiDown = false;
      const fetchDay = async (
        day: string,
        currencies: ConvertibleCurrency[],
      ) => {
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
            rates.set(`${day}|${currency.id}`, 1 / value);
            await rateRepository.save(
              new Date(`${day}T00:00:00.000Z`),
              currency.id,
              target.id,
              1 / value,
            );
          }
        } catch {
          // Por configurar ou em baixo: o resto vai pela cotação de referência
          apiDown = true;
        }
      };
      for (let index = 0; index < missing.length; index += FETCH_CONCURRENCY)
        await Promise.all(
          missing
            .slice(index, index + FETCH_CONCURRENCY)
            .map(([day, currencies]) => fetchDay(day, currencies)),
        );
    }
  }

  return {
    convert: (amount, currency, day, hour) => {
      if (!target || currency.id === target.id) return amount;
      const byHour = hourRate(amount, currency, hourFor(day, hour));
      if (byHour !== null) return byHour;
      const key = `${dayOf(day)}|${currency.id}`;
      const rate = rates.get(key);
      if (rate !== undefined) return amount * rate;
      estimated.add(key);
      return fallback(amount, currency);
    },
    estimated: () => estimated.size,
  };
}
