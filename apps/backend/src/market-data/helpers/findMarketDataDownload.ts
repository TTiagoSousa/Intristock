import { NotFoundException } from '@nestjs/common';
import { PrismaMarketDataRepository } from '../repositories/prisma/prisma-market-data-repository';

// Cada utilizador só vê os seus pedidos
export async function findMarketDataDownload(
  userId: string,
  id: string,
  repository: PrismaMarketDataRepository,
) {
  const download = await repository.findDownload(id, userId);
  if (!download) throw new NotFoundException('Pedido não encontrado');
  return download;
}
