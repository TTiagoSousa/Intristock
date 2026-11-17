import { CurrencyService } from 'src/currency/currency.service';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';
import { PortfolioTransactionFilters } from '../repositories/personal-portfolio-repository';
import { PortfolioTransactionsQueryDto } from '../dto/personal-portfolio.dto';
import { CASH_SIGN } from './portfolioLedger';

const DEFAULT_TAKE = 20;
const FALLBACK_CURRENCY = 'EUR';
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Todas as transações da pessoa, das mais recentes, às páginas, com os filtros
 * (portefólio, manual ou de uma corretora, plataforma, ativo, tipo, datas). Nos
 * portefólios de uma ligação com `fromDate`, só desse dia em diante. Leva também
 * quantas são ao todo, o dinheiro que entrou menos o que saiu de todas (na moeda
 * pedida, à cotação do dia de cada uma) e os ativos que a pessoa tem nalguma
 * transação, para o filtro.
 */
export async function findAllTransactions(
  userId: string,
  query: PortfolioTransactionsQueryDto,
  repository: PrismaPersonalPortfolioRepository,
  currencyService: CurrencyService,
) {
  const portfolios = await repository.findPortfolios(userId);
  const filters: PortfolioTransactionFilters = {
    portfolioId: query.portfolioId,
    source: query.source,
    platformId: query.platformId,
    assetId: query.assetId,
    kind: query.kind,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
    fromDates: new Map(
      portfolios.flatMap((p) => (p.connection?.fromDate ? [[p.id, p.connection.fromDate] as const] : [])),
    ),
  };
  const take = query.take ?? DEFAULT_TAKE;
  const page = query.page ?? 1;

  const [transactions, total, amounts, assets, currency] = await Promise.all([
    repository.findTransactionList(userId, filters, { skip: (page - 1) * take, take }),
    repository.countTransactionList(userId, filters),
    repository.findTransactionListAmounts(userId, filters),
    repository.findUserAssets(userId),
    query.currencyId
      ? repository.findCurrency(query.currencyId)
      : repository.findCurrencyByCode(FALLBACK_CURRENCY),
  ]);

  // O dinheiro: o que entrou menos o que saiu (as compras e vendas de ações não contam,
  // o dinheiro delas está na linha do portefólio do dinheiro)
  const cash = amounts.filter((row) => row.kind in CASH_SIGN);
  const days = cash.map((row) => ({ currency: row.currency, day: row.date.toISOString().slice(0, 10) }));
  const converter = await currencyService.converter(currency, days);
  const net = cash.reduce(
    (sum, row, index) =>
      sum + CASH_SIGN[row.kind] * converter.convert(Number(row.amount), row.currency, days[index].day),
    0,
  );

  return {
    transactions,
    total,
    page,
    take,
    net: round(net),
    currency: currency ? { id: currency.id, shortCode: currency.shortCode, symbol: currency.symbol } : null,
    estimatedRates: converter.estimated(),
    assets,
  };
}
