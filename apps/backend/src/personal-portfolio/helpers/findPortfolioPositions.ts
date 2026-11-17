import { NotFoundException } from '@nestjs/common';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';
import {
  PortfolioCurrency,
  PortfolioTransactionWithRefs,
} from '../repositories/personal-portfolio-repository';
import { applyToPosition, emptyPosition, Position, POSITION_SIGN, priceCurrency } from './portfolioLedger';

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * As posições de um portefólio (as ações que tem e as que já teve): a quantidade, o custo
 * médio e o realizado na moeda das compras, e o último fecho do mercado de onde vem o
 * preço, com o valor na moeda dele. As fechadas vêm no fim, com o que se ganhou nelas.
 */
export async function findPortfolioPositions(
  userId: string,
  portfolioId: string,
  repository: PrismaPersonalPortfolioRepository,
) {
  const portfolio = await repository.findPortfolio(userId, portfolioId);
  if (!portfolio) throw new NotFoundException('Portefólio não encontrado');

  const transactions = (await repository.findTransactions(portfolioId))
    .filter((tx) => tx.kind in POSITION_SIGN)
    .reverse();

  type Row = Position & { first: PortfolioTransactionWithRefs; currency: PortfolioCurrency };
  const rows = new Map<string, Row>();
  for (const tx of transactions) {
    const key = tx.instrumentId ?? tx.assetId;
    const row = rows.get(key) ?? { ...emptyPosition(), first: tx, currency: tx.currency };
    applyToPosition(row, tx.kind, Number(tx.quantity), Number(tx.amount));
    rows.set(key, row);
  }

  const priceIds = [...rows.values()].flatMap((row) =>
    row.first.instrument?.priceInstrument ? [row.first.instrument.priceInstrument.id] : [],
  );
  const latest = new Map((await repository.findLatestPrices(priceIds)).map((price) => [price.instrumentId, price]));
  // As moedas dos preços, todas de uma vez
  const codes = new Set(
    [...rows.values()].flatMap((row) =>
      row.first.instrument?.priceInstrument ? [priceCurrency(row.first.instrument.priceInstrument.quote).code] : [],
    ),
  );
  const currencies = new Map(
    (await repository.findCurrenciesByCodes([...codes])).map((currency) => [currency.shortCode, currency]),
  );

  const result = [...rows.values()].map((row) => {
    const market = row.first.instrument?.priceInstrument ?? null;
    const price = market ? latest.get(market.id) : undefined;
    const unit = market ? priceCurrency(market.quote) : null;
    const valueCurrency = unit ? (currencies.get(unit.code) ?? null) : null;
    return {
      asset: row.first.asset,
      symbol: row.first.instrument?.symbol ?? null,
      priceSymbol: market?.symbol ?? null,
      quantity: round(row.quantity, 8),
      cost: round(row.cost),
      averageCost: row.quantity ? round(row.cost / row.quantity, 6) : null,
      realized: round(row.realized),
      currency: row.currency,
      price:
        price && unit && valueCurrency
          ? { close: price.close, date: price.date, quote: market!.quote, currency: valueCurrency }
          : null,
      // Na moeda do preço (GBX já em libras)
      value: price && unit ? round(row.quantity * price.close * unit.factor) : null,
    };
  });
  return result.sort((a, b) => Number(b.quantity > 0) - Number(a.quantity > 0) || a.asset.name.localeCompare(b.asset.name));
}
