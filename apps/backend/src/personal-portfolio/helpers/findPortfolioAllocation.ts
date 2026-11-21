import { pickDisplayCurrency } from 'src/currency/helpers/pickDisplayCurrency';
import { CurrencyService } from 'src/currency/currency.service';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';
import { PortfolioCurrency } from '../repositories/personal-portfolio-repository';
import { applyToPosition, CASH_SIGN, compareLedger, emptyPosition, Position, POSITION_SIGN, priceCurrency, priceMarketOf } from './portfolioLedger';

// As categorias gerais da distribuição, por esta ordem
export const ALLOCATION_CATEGORIES = ['cash', 'securities', 'crypto', 'property', 'goods', 'other'] as const;
export type AllocationCategory = (typeof ALLOCATION_CATEGORIES)[number];

// Abaixo disto (na moeda pedida) não conta: saldos a zero, arredondamentos
const MIN_VALUE = 0.005;
const round = (value: number) => Math.round(value * 100) / 100;

/** A categoria geral de um ativo, pelo `subClass` (e o `assetClass` quando não diz). */
export function allocationCategory(subClass: string, assetClass: string): AllocationCategory {
  if (subClass === 'cash' || assetClass === 'liquidity') return 'cash';
  if (subClass === 'crypto') return 'crypto';
  if (['stock', 'etf', 'fund', 'index', 'bond'].includes(subClass) || ['equity', 'fixed_income'].includes(assetClass))
    return 'securities';
  if (subClass === 'property' || assetClass === 'real_estate') return 'property';
  if (['vehicle', 'collectible', 'precious_metal', 'commodity'].includes(subClass) || assetClass === 'commodity')
    return 'goods';
  return 'other';
}

type Holding = {
  id: string;
  name: string;
  ticker: string | null;
  category: AllocationCategory;
  // O valor na moeda dele e a moeda (para converter)
  amount: number;
  currency: PortfolioCurrency;
};

/**
 * O que a pessoa tem hoje, em todos os portefólios, numa moeda: o dinheiro de cada moeda
 * (somado de todos os portefólios, um ativo por moeda) e cada posição (a quantidade ×
 * o último fecho do mercado dela; sem ele, o último preço de compra/venda), à cotação de
 * hoje. Agrupado pelas categorias gerais e, dentro de cada uma, por ativo, do maior.
 * Os saldos negativos ou a zero ficam de fora (a distribuição é do que se tem).
 */
export async function findPortfolioAllocation(
  userId: string,
  currencyId: string | undefined,
  repository: PrismaPersonalPortfolioRepository,
  currencyService: CurrencyService,
) {
  const transactions = (await repository.findUserTransactions(userId)).sort(compareLedger);
  const currency = await pickDisplayCurrency(currencyId, [], repository);

  // O dinheiro por moeda e as posições por mercado (ou ativo), de todos os portefólios
  const cash = new Map<string, { amount: number; currency: PortfolioCurrency }>();
  type Row = Position & { tx: (typeof transactions)[number] };
  const positions = new Map<string, Row>();
  for (const tx of transactions) {
    const amount = Number(tx.amount);
    if (tx.kind in POSITION_SIGN) {
      const key = tx.instrumentId ?? tx.assetId;
      const row = positions.get(key) ?? { ...emptyPosition(), tx };
      applyToPosition(row, tx.kind, Number(tx.quantity), amount);
      positions.set(key, row);
    } else if (tx.kind in CASH_SIGN) {
      const row = cash.get(tx.currencyId) ?? { amount: 0, currency: tx.currency };
      row.amount += CASH_SIGN[tx.kind] * amount;
      cash.set(tx.currencyId, row);
    }
  }

  const open = [...positions.values()].filter((row) => row.quantity > 0);
  const markets = open.flatMap((row) => {
    const market = priceMarketOf(row.tx.instrument);
    return market ? [market] : [];
  });
  const latest = new Map(
    (await repository.findLatestPrices(markets.map((market) => market.id))).map((price) => [price.instrumentId, price]),
  );
  const codes = [...new Set(markets.map((market) => priceCurrency(market.quote).code))];
  const priceCurrencies = new Map((await repository.findCurrenciesByCodes(codes)).map((found) => [found.shortCode, found]));

  const holdings: Holding[] = [];
  for (const row of cash.values())
    holdings.push({
      id: `cash:${row.currency.id}`,
      name: row.currency.name,
      ticker: row.currency.shortCode,
      category: 'cash',
      amount: row.amount,
      currency: row.currency,
    });
  for (const row of open) {
    const market = priceMarketOf(row.tx.instrument);
    const close = market ? latest.get(market.id) : undefined;
    const unit = market ? priceCurrency(market.quote) : null;
    const unitCurrency = unit ? priceCurrencies.get(unit.code) : undefined;
    const priced = close && unit && unitCurrency;
    holdings.push({
      id: row.tx.assetId,
      name: row.tx.asset.name,
      ticker: row.tx.instrument?.symbol ?? null,
      category: allocationCategory(row.tx.asset.subClass, row.tx.asset.assetClass),
      amount: priced ? row.quantity * close.close * unit.factor : row.quantity * row.lastUnitPrice,
      currency: priced ? unitCurrency : row.tx.currency,
    });
  }

  // Tudo à cotação de hoje
  const converter = await currencyService.converter(
    currency,
    holdings.map((holding) => ({ currency: holding.currency })),
  );
  const byCategory = new Map<AllocationCategory, Map<string, { id: string; name: string; ticker: string | null; value: number }>>();
  for (const holding of holdings) {
    const value = converter.convert(holding.amount, holding.currency);
    if (value < MIN_VALUE) continue;
    const assets = byCategory.get(holding.category) ?? new Map();
    // O mesmo ativo em mercados diferentes junta-se
    const current = assets.get(holding.id);
    assets.set(holding.id, {
      id: holding.id,
      name: holding.name,
      ticker: current?.ticker ?? holding.ticker,
      value: (current?.value ?? 0) + value,
    });
    byCategory.set(holding.category, assets);
  }

  const categories = ALLOCATION_CATEGORIES.flatMap((key) => {
    const assets = [...(byCategory.get(key)?.values() ?? [])]
      .map((asset) => ({ ...asset, value: round(asset.value) }))
      .sort((a, b) => b.value - a.value);
    const value = round(assets.reduce((sum, asset) => sum + asset.value, 0));
    return value >= MIN_VALUE ? [{ key, value, assets }] : [];
  }).sort((a, b) => b.value - a.value);

  return {
    currency: currency ? { id: currency.id, shortCode: currency.shortCode, symbol: currency.symbol } : null,
    total: round(categories.reduce((sum, category) => sum + category.value, 0)),
    estimatedRates: converter.estimated(),
    categories,
  };
}
