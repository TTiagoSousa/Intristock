import { isoDay } from 'src/utils/dates';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';
import { applyToPosition, compareLedger, emptyPosition } from './portfolioLedger';


/**
 * As transações de um bem e o que dizem: onde está, se ainda se tem, o que custou e o que
 * vale. O valor de hoje só conta as avaliações até hoje (uma com data à frente não vale já).
 */
export async function goodsState(userId: string, assetId: string, repository: PrismaPersonalPortfolioRepository) {
  const transactions = await repository.findGoodsTransactions(userId, assetId);
  const own = transactions.filter((tx) => ['buy', 'sell', 'valuation'].includes(tx.kind)).sort(compareLedger);
  const today = isoDay(new Date());
  const position = emptyPosition();
  for (const tx of own)
    if (tx.kind !== 'valuation' || isoDay(tx.date) <= today)
      applyToPosition(position, tx.kind, Number(tx.quantity), Number(tx.amount));
  const buy = own.find((tx) => tx.kind === 'buy') ?? null;
  const sale = [...own].reverse().find((tx) => tx.kind === 'sell') ?? null;
  return { transactions: own, position, buy, sale };
}
