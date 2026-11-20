import { NotFoundException } from '@nestjs/common';
import { PrismaPersonalPortfolioRepository } from '../repositories/prisma/prisma-personal-portfolio-repository';
import { UpdateGoodsDto } from '../dto/goods.dto';
import { defaultSearchQuery, goodsName } from './goodsNaming';

const DAY_MS = 86_400_000;

/**
 * Muda um bem: o nome, os dados e a pesquisa de preços, e a atualização automática (mudar o
 * intervalo marca a próxima a contar de agora; nulo desliga-a).
 */
export async function updateGoods(
  userId: string,
  assetId: string,
  dto: UpdateGoodsDto,
  repository: PrismaPersonalPortfolioRepository,
) {
  const asset = await repository.findGoodsAsset(userId, assetId);
  if (!asset) throw new NotFoundException('Bem não encontrado');
  const data: Parameters<PrismaPersonalPortfolioRepository['updateGoodsAsset']>[1] = {};
  if (dto.details) {
    data.details = { ...dto.details, searchQuery: dto.details.searchQuery?.trim() || defaultSearchQuery(dto.details) };
    if (dto.name === undefined) data.name = goodsName(dto.details);
  }
  if (dto.name !== undefined && dto.details) data.name = goodsName(dto.details, dto.name);
  else if (dto.name?.trim()) data.name = dto.name.trim();
  if (dto.valuationEveryDays !== undefined && dto.valuationEveryDays !== asset.valuationEveryDays) {
    data.valuationEveryDays = dto.valuationEveryDays;
    data.valuationNextAt = dto.valuationEveryDays ? new Date(Date.now() + dto.valuationEveryDays * DAY_MS) : null;
  }
  await repository.updateGoodsAsset(assetId, data);
  return { assetId };
}
