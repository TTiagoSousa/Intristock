import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CurrencyService } from 'src/currency/currency.service';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';
import { AddGoodsValuationDto } from '../dto/goods.dto';
import { goodsState } from './goodsState';
import { resolveGoodsValuation } from './resolveGoodsValuation';
import { assertGoodsDate } from './assertGoodsDate';
import { convertGoodsValuation } from './convertGoodsValuation';

const DAY_MS = 86_400_000;
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Uma avaliação nova de um bem que ainda se tem: o valor à mão ou o de uma pesquisa (com o
 * relatório), na data dada (hoje, por omissão; entre a entrada e hoje), no portefólio e na
 * moeda da entrada — os anúncios noutra moeda convertem-se pela cotação desse dia. Com a
 * atualização automática, a próxima conta a partir desta.
 */
export async function addGoodsValuation(
  userId: string,
  assetId: string,
  dto: AddGoodsValuationDto,
  repository: PrismaPersonalPortfolioRepository,
  currencyService: CurrencyService,
  origin: 'manual' | 'auto' = 'manual',
) {
  const asset = await repository.findGoodsAsset(userId, assetId);
  if (!asset) throw new NotFoundException('Bem não encontrado');
  const { position, buy } = await goodsState(userId, assetId, repository);
  if (!buy || position.quantity <= 0) throw new BadRequestException('Este bem já foi vendido');
  const resolved = resolveGoodsValuation(dto);
  if (!resolved) throw new BadRequestException('Escreve o valor ou pesquisa o preço');

  const today = new Date(new Date().toISOString().slice(0, 10));
  const date = dto.date ? new Date(dto.date) : today;
  assertGoodsDate(date, buy.date, 'valuation');
  const valuation = await convertGoodsValuation(
    resolved,
    buy.currency,
    date.toISOString().slice(0, 10),
    repository,
    currencyService,
  );

  await repository.createTransactions([
    {
      portfolioId: buy.portfolioId,
      assetId,
      kind: 'valuation',
      date,
      quantity: 0,
      price: round(valuation.value),
      amount: round(valuation.value),
      currencyId: buy.currencyId,
      bankAccountId: null,
      notes: dto.notes?.trim() || (origin === 'auto' ? 'Atualização automática' : null),
      valuationReport: valuation.report,
    },
  ]);
  if (asset.valuationEveryDays)
    await repository.updateGoodsAsset(assetId, {
      valuationNextAt: new Date(Date.now() + asset.valuationEveryDays * DAY_MS),
    });
  return { assetId, value: round(valuation.value) };
}
