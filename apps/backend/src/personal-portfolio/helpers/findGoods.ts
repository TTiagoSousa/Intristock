import { NotFoundException } from '@nestjs/common';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';
import { goodsState } from './goodsState';
import { ValuationReport } from './valuationReport';

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Um bem da pessoa (uma mota): os dados, a atualização automática, o portefólio, o que
 * custou, o que vale hoje (a última avaliação; sem nenhuma, a entrada), a venda se já se
 * vendeu, as avaliações ao longo do tempo e o relatório da última pesquisa.
 */
export async function findGoods(userId: string, assetId: string, repository: PrismaPersonalPortfolioRepository) {
  const asset = await repository.findGoodsAsset(userId, assetId);
  if (!asset) throw new NotFoundException('Bem não encontrado');
  const { transactions, position, buy, sale } = await goodsState(userId, assetId, repository);

  const valuations = transactions.filter((tx) => tx.kind === 'valuation' || tx.kind === 'buy');
  const lastReport = [...transactions].reverse().find((tx) => tx.valuationReport)?.valuationReport ?? null;
  const currency = buy?.currency ?? null;
  return {
    asset,
    portfolio: buy?.portfolio ?? null,
    currency,
    held: position.quantity > 0,
    acquisition: buy?.acquisition ?? null,
    acquiredAt: buy?.date ?? null,
    // O preço de compra (nulo numa oferta) e o valor com que entrou
    purchasePrice: buy?.price !== null && buy?.price !== undefined ? Number(buy.price) : null,
    entryValue: buy ? Number(buy.amount) : null,
    value: position.quantity > 0 ? round(position.quantity * position.lastUnitPrice) : 0,
    sale: sale ? { date: sale.date, price: Number(sale.amount), realized: round(position.realized) } : null,
    history: valuations.map((tx) => ({
      id: tx.id,
      kind: tx.kind,
      date: tx.date,
      value: Number(tx.amount),
      source: tx.valuationReport ? 'search' : tx.kind === 'buy' ? 'entry' : 'manual',
      condition: (tx.valuationReport as ValuationReport | null)?.condition ?? null,
      notes: tx.notes,
    })),
    report: lastReport as ValuationReport | null,
  };
}
