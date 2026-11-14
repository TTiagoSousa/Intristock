import { CurrencyService } from 'src/currency/currency.service';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';

// Sem moeda pedida, a das transações mais usada, senão o euro
const FALLBACK_CURRENCY = 'EUR';

// O que cada tipo faz ao saldo do dinheiro
const CASH_SIGN: Record<string, number> = {
  deposit: 1,
  interest: 1,
  withdrawal: -1,
  fee: -1,
  tax: -1,
};

// Os dias que o gráfico mostra, no mínimo
const MIN_DAYS = 30;

const round = (value: number) => Math.round(value * 100) / 100;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * O valor de cada portefólio ao longo do tempo, numa moeda: um ponto por dia,
 * desde a primeira transação até hoje, com o saldo de cada um e o total. O saldo
 * guarda-se na moeda de cada transação e converte-se pela cotação de cada dia,
 * por isso noutra moeda a linha acompanha o câmbio. Para já só há dinheiro.
 */
export async function summarizePortfolios(
  userId: string,
  currencyId: string | undefined,
  repository: PrismaPersonalPortfolioRepository,
  currencyService: CurrencyService,
) {
  const [portfolios, transactions] = await Promise.all([
    repository.findPortfolios(userId),
    repository.findUserTransactions(userId),
  ]);

  let currency = currencyId ? await repository.findCurrency(currencyId) : null;
  if (!currency) {
    const uses = new Map<string, number>();
    for (const tx of transactions)
      uses.set(tx.currencyId, (uses.get(tx.currencyId) ?? 0) + 1);
    const top = [...uses.entries()].sort((a, b) => b[1] - a[1])[0];
    currency = top
      ? await repository.findCurrency(top[0])
      : await repository.findCurrencyByCode(FALLBACK_CURRENCY);
  }

  // Os dias do gráfico: do da primeira transação a hoje, todos (cada um à
  // cotação dele, para o saldo noutra moeda variar com ela)
  const today = isoDay(new Date());
  const days: string[] = [];
  if (transactions.length)
    for (
      const day = new Date(`${isoDay(transactions[0].date)}T00:00:00.000Z`);
      isoDay(day) <= today;
      day.setUTCDate(day.getUTCDate() + 1)
    )
      days.push(isoDay(day));
  const currencies = new Map(
    transactions.map((tx) => [tx.currencyId, tx.currency]),
  );

  const converter = await currencyService.converter(
    currency,
    days.flatMap((day) =>
      [...currencies.values()].map((c) => ({ currency: c, day })),
    ),
  );

  // O saldo de cada portefólio em cada moeda, na moeda dela; em cada dia
  // converte-se tudo pela cotação desse dia
  const balance = new Map<string, Map<string, number>>(
    portfolios.map((p) => [p.id, new Map()]),
  );
  const points: {
    date: string;
    values: Record<string, number>;
    total: number;
  }[] = [];
  const push = (date: string, valued: boolean) => {
    const values: Record<string, number> = {};
    let total = 0;
    for (const [id, byCurrency] of balance) {
      let value = 0;
      if (valued)
        for (const [currencyKey, amount] of byCurrency)
          value += converter.convert(
            amount,
            currencies.get(currencyKey)!,
            date,
          );
      values[id] = round(value);
      total += value;
    }
    points.push({ date, values, total: round(total) });
  };
  // A linha começa a 0: no dia antes da primeira transação e, para o gráfico
  // ter pelo menos um mês, também MIN_DAYS dias antes de hoje
  if (transactions.length) {
    const before = new Date(transactions[0].date);
    before.setUTCDate(before.getUTCDate() - 1);
    const floor = new Date();
    floor.setUTCDate(floor.getUTCDate() - MIN_DAYS);
    if (floor < before) push(isoDay(floor), false);
    push(isoDay(before), false);
  }
  let next = 0;
  for (const day of days) {
    for (; next < transactions.length; next += 1) {
      const tx = transactions[next];
      if (isoDay(tx.date) > day) break;
      const byCurrency =
        balance.get(tx.portfolioId) ?? new Map<string, number>();
      byCurrency.set(
        tx.currencyId,
        (byCurrency.get(tx.currencyId) ?? 0) +
          (CASH_SIGN[tx.kind] ?? 0) * Number(tx.amount),
      );
      balance.set(tx.portfolioId, byCurrency);
    }
    push(day, true);
  }

  return {
    currency: currency
      ? {
          id: currency.id,
          shortCode: currency.shortCode,
          symbol: currency.symbol,
        }
      : null,
    estimatedRates: converter.estimated(),
    portfolios: portfolios.map((p) => ({ id: p.id, name: p.name })),
    points,
  };
}
