import { CurrencyService } from 'src/currency/currency.service';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';
import { PortfolioCurrency } from '../repositories/personal-portfolio-repository';
import {
  applyToPosition,
  CASH_SIGN,
  emptyPosition,
  priceMarketOf,
  PriceMarket,
  Position,
  POSITION_SIGN,
  priceCurrency,
} from './portfolioLedger';
import { computeReturns, ReturnPoint, ReturnStep } from './portfolioReturns';

// O dinheiro que a pessoa mete ou tira: não é ganho nem perda (as transferências são
// entre o dinheiro e as ações da mesma conta, ficam dentro)
const EXTERNAL_FLOW: Record<string, number> = { deposit: 1, withdrawal: -1 };

// Sem moeda pedida, a das transações mais usada, senão o euro
const FALLBACK_CURRENCY = 'EUR';

// Os períodos do gráfico: desde a primeira transação, ou para trás de hoje. Os curtos
// vão hora a hora (o dinheiro pelo instante de cada movimento, as cotações de cada hora)
export const SUMMARY_RANGES = ['all', '5y', '2y', '1y', '6m', '3m', '1m', '7d', '24h'] as const;
export type SummaryRange = (typeof SUMMARY_RANGES)[number];
const RANGE_START: Record<Exclude<SummaryRange, 'all'>, { months?: number; hours?: number }> = {
  '5y': { months: 60 },
  '2y': { months: 24 },
  '1y': { months: 12 },
  '6m': { months: 6 },
  '3m': { months: 3 },
  '1m': { months: 1 },
  '7d': { hours: 7 * 24 },
  '24h': { hours: 24 },
};

// Em "desde sempre", o gráfico mostra pelo menos um mês
const MIN_DAYS = 30;
const HOUR_MS = 3_600_000;

const round = (value: number) => Math.round(value * 100) / 100;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const midnight = (day: string) => new Date(`${day}T00:00:00.000Z`);

type PricedPosition = Position & {
  // A moeda das compras (o custo e o último preço delas)
  currency: PortfolioCurrency;
  // O mercado de onde vem o fecho, se houver
  priceId: string | null;
};

// Um ponto do gráfico: o rótulo (o dia, ou a hora em ISO), o dia do fecho e das
// cotações, até quando contam as transações e, hora a hora, a hora das cotações
type Slot = { label: string; day: string; until: Date; hour: Date | null };

// Um preço de hora a hora: o instante (ms) em que já havia esse fecho
export type HourClose = { time: number; close: number };

/**
 * O valor de cada portefólio ao longo do tempo, numa moeda, no período pedido: um ponto
 * por dia (por hora nos de 7 dias e 24 horas), com o valor de cada um e o total. O valor é
 * o dinheiro de cada moeda mais as posições (a quantidade × o fecho desse dia do mercado
 * delas, ou o último anterior; sem nenhum, o preço da última compra ou venda), tudo
 * convertido pela cotação desse dia (ou hora) — por isso noutra moeda a linha acompanha o
 * câmbio. Hora a hora, as posições vão pelo preço dessa hora (`hourlyCloses`), se o houver. O que é de antes do período conta para o valor do primeiro ponto. Num
 * portefólio de uma corretora com `fromDate`, o que é de antes entra todo nesse dia.
 */
export async function summarizePortfolios(
  userId: string,
  currencyId: string | undefined,
  range: SummaryRange,
  repository: PrismaPersonalPortfolioRepository,
  currencyService: CurrencyService,
  // Nos períodos de hora a hora, os fechos de hora a hora de cada mercado (do Yahoo)
  hourlyCloses?: (markets: PriceMarket[]) => Promise<Map<string, HourClose[]>>,
) {
  const [portfolios, allTransactions] = await Promise.all([
    repository.findPortfolios(userId),
    repository.findUserTransactions(userId),
  ]);
  const fromDates = new Map(
    portfolios.flatMap((p) => (p.connection?.fromDate ? [[p.id, p.connection.fromDate] as const] : [])),
  );
  // Cada transação conta no instante dela (o da corretora; nas manuais, o dia)
  const transactions = allTransactions
    .map((tx) => {
      const from = fromDates.get(tx.portfolioId);
      const clamped = from && tx.date < from;
      return { ...tx, date: clamped ? from : tx.date, at: clamped ? from : (tx.externalAt ?? tx.date) };
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  let currency = currencyId ? await repository.findCurrency(currencyId) : null;
  if (!currency) {
    const uses = new Map<string, number>();
    for (const tx of transactions) uses.set(tx.currencyId, (uses.get(tx.currencyId) ?? 0) + 1);
    const top = [...uses.entries()].sort((a, b) => b[1] - a[1])[0];
    currency = top
      ? await repository.findCurrency(top[0])
      : await repository.findCurrencyByCode(FALLBACK_CURRENCY);
  }

  // Os pontos do período
  const now = new Date();
  const today = isoDay(now);
  const slots: Slot[] = [];
  const hourly = range === '7d' || range === '24h';
  if (transactions.length) {
    if (hourly) {
      const last = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
      for (let time = last.getTime() - RANGE_START[range].hours! * HOUR_MS; time <= last.getTime(); time += HOUR_MS) {
        const hour = new Date(time);
        slots.push({ label: hour.toISOString(), day: isoDay(hour), until: new Date(time + HOUR_MS), hour });
      }
    } else {
      let start = isoDay(transactions[0].date);
      if (range !== 'all') {
        const from = new Date(now);
        from.setUTCMonth(from.getUTCMonth() - RANGE_START[range].months!);
        if (isoDay(from) > start) start = isoDay(from);
      }
      for (const day = midnight(start); isoDay(day) <= today; day.setUTCDate(day.getUTCDate() + 1)) {
        const next = new Date(day);
        next.setUTCDate(next.getUTCDate() + 1);
        slots.push({ label: isoDay(day), day: isoDay(day), until: next, hour: null });
      }
    }
  }

  // Os fechos dos mercados das posições e a moeda de cada um
  const priceMarkets = new Map<string, PriceMarket>();
  for (const tx of transactions) {
    const market = priceMarketOf(tx.instrument);
    if (market) priceMarkets.set(market.id, market);
  }
  const series = await repository.findPriceSeries([...priceMarkets.keys()]);
  const units = new Map([...priceMarkets].map(([id, market]) => [id, priceCurrency(market.quote)]));
  const unitCurrencies = new Map(
    (await repository.findCurrenciesByCodes([...new Set([...units.values()].map((unit) => unit.code))])).map(
      (found) => [found.shortCode, found],
    ),
  );
  const priceUnits = new Map<string, { currency: PortfolioCurrency; factor: number }>();
  for (const [id, unit] of units) {
    const found = unitCurrencies.get(unit.code);
    if (found) priceUnits.set(id, { currency: found, factor: unit.factor });
  }
  // Hora a hora, o preço de cada hora (sem ele, o fecho do dia, como nos outros períodos)
  const hourSeries =
    hourly && hourlyCloses && priceMarkets.size
      ? await hourlyCloses([...priceMarkets.values()])
      : new Map<string, HourClose[]>();
  const hourNext = new Map<string, number>();

  const currencies = new Map<string, PortfolioCurrency>(transactions.map((tx) => [tx.currencyId, tx.currency]));
  for (const unit of priceUnits.values()) currencies.set(unit.currency.id, unit.currency);
  const converter = await currencyService.converter(
    currency,
    slots.flatMap((slot) => [...currencies.values()].map((c) => ({ currency: c, day: slot.day, hour: slot.hour }))),
  );

  // O dinheiro de cada portefólio em cada moeda e as posições de cada um
  const cash = new Map<string, Map<string, number>>(portfolios.map((p) => [p.id, new Map()]));
  const positions = new Map<string, Map<string, PricedPosition>>(portfolios.map((p) => [p.id, new Map()]));
  // O último fecho de cada mercado até ao ponto em que se vai (do dia e, hora a hora, da hora)
  const closes = new Map<string, number>();
  const hourCloses = new Map<string, number>();
  let nextPrice = 0;

  const points: { date: string; values: Record<string, number>; total: number }[] = [];
  const push = (slot: Pick<Slot, 'label' | 'day' | 'hour'>, valued: boolean) => {
    const values: Record<string, number> = {};
    let total = 0;
    for (const portfolio of portfolios) {
      let value = 0;
      if (valued) {
        for (const [currencyKey, amount] of cash.get(portfolio.id) ?? [])
          value += converter.convert(amount, currencies.get(currencyKey)!, slot.day, slot.hour);
        for (const position of positions.get(portfolio.id)?.values() ?? []) {
          if (!position.quantity) continue;
          const close = position.priceId
            ? (hourCloses.get(position.priceId) ?? closes.get(position.priceId))
            : undefined;
          const unit = position.priceId ? priceUnits.get(position.priceId) : undefined;
          value +=
            close !== undefined && unit
              ? converter.convert(position.quantity * close * unit.factor, unit.currency, slot.day, slot.hour)
              : converter.convert(position.quantity * position.lastUnitPrice, position.currency, slot.day, slot.hour);
        }
      }
      values[portfolio.id] = round(value);
      total += value;
    }
    points.push({ date: slot.label, values, total: round(total) });
  };

  // Desde sempre, a linha começa a 0: no dia antes da primeira transação e, para o
  // gráfico ter pelo menos um mês, também MIN_DAYS dias antes de hoje
  if (range === 'all' && transactions.length) {
    const before = new Date(transactions[0].date);
    before.setUTCDate(before.getUTCDate() - 1);
    const floor = new Date();
    floor.setUTCDate(floor.getUTCDate() - MIN_DAYS);
    if (floor < before) push({ label: isoDay(floor), day: isoDay(floor), hour: null }, false);
    push({ label: isoDay(before), day: isoDay(before), hour: null }, false);
  }

  // A partir daqui, um ponto por slot: o que entrou e saiu em cada um, para a rentabilidade
  const lead = points.length;
  const steps: ReturnStep[] = [];
  let next = 0;
  for (const slot of slots) {
    let flow = 0;
    for (; nextPrice < series.length && isoDay(series[nextPrice].date) <= slot.day; nextPrice += 1)
      closes.set(series[nextPrice].instrumentId, series[nextPrice].close);
    for (const [id, list] of hourSeries) {
      let index = hourNext.get(id) ?? 0;
      for (; index < list.length && list[index].time <= slot.until.getTime(); index += 1)
        hourCloses.set(id, list[index].close);
      hourNext.set(id, index);
    }

    for (; next < transactions.length; next += 1) {
      const tx = transactions[next];
      if (tx.at >= slot.until) break;
      const amount = Number(tx.amount);
      if (tx.kind in POSITION_SIGN) {
        const byKey = positions.get(tx.portfolioId) ?? new Map<string, PricedPosition>();
        const key = tx.instrumentId ?? tx.assetId;
        const position =
          byKey.get(key) ??
          ({ ...emptyPosition(), currency: tx.currency, priceId: priceMarketOf(tx.instrument)?.id ?? null } as PricedPosition);
        applyToPosition(position, tx.kind, Number(tx.quantity), amount);
        byKey.set(key, position);
        positions.set(tx.portfolioId, byKey);
      } else {
        const byCurrency = cash.get(tx.portfolioId) ?? new Map<string, number>();
        byCurrency.set(tx.currencyId, (byCurrency.get(tx.currencyId) ?? 0) + (CASH_SIGN[tx.kind] ?? 0) * amount);
        cash.set(tx.portfolioId, byCurrency);
        // À cotação desse ponto, como o valor
        if (tx.kind in EXTERNAL_FLOW)
          flow += EXTERNAL_FLOW[tx.kind] * converter.convert(amount, tx.currency, slot.day, slot.hour);
      }
    }
    push(slot, true);
    const start = slot.hour ? slot.hour.getTime() : midnight(slot.day).getTime();
    steps.push({ start, end: slot.until.getTime(), value: points[points.length - 1].total, flow });
  }

  // A rentabilidade de cada ponto (os de antes, a 0, valem 0 %)
  const returns = computeReturns(steps, range === 'all');
  const zero: ReturnPoint = { invested: 0, gain: 0, simplePct: 0, twrPct: 0, mwrPct: 0 };
  const withReturns = points.map((point, index) => ({
    ...point,
    ...(index < lead ? zero : returns.points[index - lead]),
  }));
  const last = withReturns[withReturns.length - 1];

  return {
    currency: currency ? { id: currency.id, shortCode: currency.shortCode, symbol: currency.symbol } : null,
    range,
    granularity: hourly ? 'hour' : 'day',
    estimatedRates: converter.estimated(),
    portfolios: portfolios.map((p) => ({ id: p.id, name: p.name, source: p.source, platform: p.platform })),
    points: withReturns,
    // O resultado do período: o último ponto e a TIR anual
    returns: last
      ? {
          invested: last.invested,
          gain: last.gain,
          simplePct: last.simplePct,
          twrPct: last.twrPct,
          mwrPct: last.mwrPct,
          xirrPct: returns.xirrPct,
          days: returns.days,
        }
      : null,
  };
}
