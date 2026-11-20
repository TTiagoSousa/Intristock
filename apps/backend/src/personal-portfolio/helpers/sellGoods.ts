import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';
import { PortfolioTransactionData } from '../repositories/personal-portfolio-repository';
import { SellGoodsDto } from '../dto/goods.dto';
import { IN_KIND } from './portfolioLedger';
import { goodsState } from './goodsState';
import { assertGoodsDate } from './assertGoodsDate';

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Vende um bem pelo preço escrito à mão, no portefólio onde está. O dinheiro vai para o
 * próprio portefólio e sai logo (dinheiro novo: o levantamento), para outro portefólio, ou
 * para nenhum — e aí o valor sai para fora (`in_kind`). A data é entre a entrada e hoje.
 * A atualização automática pára.
 */
export async function sellGoods(
  userId: string,
  assetId: string,
  dto: SellGoodsDto,
  repository: PrismaPersonalPortfolioRepository,
) {
  const asset = await repository.findGoodsAsset(userId, assetId);
  if (!asset) throw new NotFoundException('Bem não encontrado');
  const { position, buy } = await goodsState(userId, assetId, repository);
  if (!buy || position.quantity <= 0) throw new BadRequestException('Este bem já foi vendido');

  const date = new Date(dto.date);
  assertGoodsDate(date, buy.date, 'sale');

  const portfolioId = buy.portfolioId;
  const amount = round(dto.price);
  const cash = amount > 0 ? dto.cash : 'none';
  const cashPortfolioId = cash === 'portfolio' ? (dto.cashPortfolioId ?? portfolioId) : portfolioId;
  if (cashPortfolioId !== portfolioId) {
    const cashPortfolio = await repository.findPortfolio(userId, cashPortfolioId);
    if (!cashPortfolio) throw new NotFoundException('Portefólio do dinheiro não encontrado');
    if (cashPortfolio.source === 'api') throw new BadRequestException('O dinheiro não pode ir para um portefólio de uma corretora');
  }

  const base = { assetId, date, currencyId: buy.currencyId, bankAccountId: null, notes: dto.notes?.trim() || null };
  const rows: PortfolioTransactionData[] = [
    {
      ...base,
      portfolioId,
      kind: 'sell',
      quantity: position.quantity,
      price: round(amount / position.quantity),
      amount,
      externalType: cash === 'none' ? IN_KIND : null,
    },
  ];
  if (cash !== 'none') rows.push({ ...base, portfolioId: cashPortfolioId, kind: 'transfer_in', quantity: amount, price: null, amount });
  if (cash === 'new') {
    const cashAsset = await repository.ensureCashAsset(buy.currency);
    rows.push({ ...base, portfolioId, assetId: cashAsset.id, kind: 'withdrawal', quantity: amount, price: null, amount });
  }
  await repository.createTransactions(rows);
  await repository.updateGoodsAsset(assetId, { valuationEveryDays: null, valuationNextAt: null });
  return { assetId, sold: amount };
}
