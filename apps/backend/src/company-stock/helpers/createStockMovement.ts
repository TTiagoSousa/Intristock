import { BadRequestException } from '@nestjs/common';
import { PrismaCompanyStockRepository } from '../repositories/prisma/prisma-company-stock-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyItemRepository } from 'src/company-item/repositories/prisma/prisma-company-item-repository';
import { CreateStockMovementDto } from '../dto/create-stock-movement.dto';
import {
  assertCompanyOwnership,
  assertEnoughStock,
  assertStockItem,
} from './assertStockInput';
import { calculateStockBalance } from './calculateStockBalance';

export async function createStockMovement(
  userId: string,
  companyId: string,
  dto: CreateStockMovementDto,
  stockRepository: PrismaCompanyStockRepository,
  companyRepository: PrismaCompanyRepository,
  itemRepository: PrismaCompanyItemRepository,
) {
  await assertCompanyOwnership(userId, companyId, companyRepository, 'stock.create');
  const item = await assertStockItem(companyId, dto.itemId, itemRepository);

  if (dto.type === 'adjustment') {
    // Um acerto de zero não acerta nada
    if (dto.quantity === 0) {
      throw new BadRequestException('O acerto tem de ser diferente de zero');
    }
  } else if (dto.quantity <= 0) {
    throw new BadRequestException('A quantidade tem de ser maior do que zero');
  }

  // O custo unitário só faz sentido a entrar: à saída o custo é o médio das
  // entradas, calculado na leitura
  if (dto.type !== 'in' && dto.unitCost !== undefined) {
    throw new BadRequestException('O custo unitário só se indica nas entradas');
  }

  // Uma saída não pode levar mais do que há em mão. O saldo não está guardado
  // em lado nenhum, por isso é calculado aqui a partir dos movimentos do item.
  // Um acerto para baixo tira do stock tal como uma saída, por isso passa pela
  // mesma trava: não se acerta para menos do que há.
  if (dto.type === 'out' || (dto.type === 'adjustment' && dto.quantity < 0)) {
    const [balance] = calculateStockBalance(
      await stockRepository.findAllByItemId(companyId, dto.itemId),
    );

    assertEnoughStock(
      item.name,
      item.stockUnit,
      balance?.quantity ?? 0,
      Math.abs(dto.quantity),
    );
  }

  return stockRepository.create({
    companyId,
    itemId: dto.itemId,
    type: dto.type,
    quantity: dto.quantity,
    unitCost: dto.type === 'in' ? (dto.unitCost ?? null) : null,
    sourceType: 'manual',
    paymentId: null,
    occurredAt: new Date(dto.occurredAt),
    note: dto.note ?? null,
  });
}
