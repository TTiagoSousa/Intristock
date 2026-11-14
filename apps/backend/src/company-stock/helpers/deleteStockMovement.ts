import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaCompanyStockRepository } from '../repositories/prisma/prisma-company-stock-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { assertCompanyOwnership } from './assertStockInput';
import { calculateStockBalance } from './calculateStockBalance';

export async function deleteStockMovement(
  userId: string,
  companyId: string,
  movementId: string,
  stockRepository: PrismaCompanyStockRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertCompanyOwnership(userId, companyId, companyRepository, 'stock.delete');

  const movement = await stockRepository.findById(movementId);

  if (!movement || movement.companyId !== companyId) {
    throw new NotFoundException('Movimento não encontrado');
  }

  // Um movimento que veio de uma compra é reflexo dela: apagá-lo à mão deixava
  // o stock a dizer uma coisa e o pagamento outra. Apaga-se o pagamento.
  if (movement.sourceType !== 'manual') {
    throw new BadRequestException(
      'Este movimento foi gerado por um pagamento — apaga o pagamento para o remover',
    );
  }

  // Apagar uma entrada tira quantidade a quem já a gastou. Se o que sobra não
  // chega para as saídas registadas, o saldo ficava negativo — e o negativo é
  // exatamente o que se quer impedir, venha ele por onde vier.
  if (movement.type !== 'out') {
    const movements = await stockRepository.findAllByItemId(
      companyId,
      movement.itemId,
    );
    const [without] = calculateStockBalance(
      movements.filter((row) => row.id !== movementId),
    );

    if (without && without.quantity < 0) {
      const unit = without.stockUnit ? ` ${without.stockUnit}` : '';

      throw new BadRequestException(
        `Sem este movimento, "${without.itemName}" ficava a ${without.quantity}${unit} — apaga primeiro as saídas que dependem dele`,
      );
    }
  }

  await stockRepository.delete(movementId);
}
