import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaCompanyItemRepository } from '../repositories/prisma/prisma-company-item-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { assertCompanyOwnership } from './assertItemInput';

export async function deleteCompanyItem(
  userId: string,
  companyId: string,
  itemId: string,
  itemRepository: PrismaCompanyItemRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertCompanyOwnership(userId, companyId, companyRepository, 'items.delete');

  const item = await itemRepository.findById(itemId);

  if (!item || item.companyId !== companyId) {
    throw new NotFoundException('Item não encontrado');
  }

  // Apagar um item já comprado destruiria o histórico das linhas de compra.
  // Para o retirar de circulação usa-se `isActive: false`.
  const usedInPayments = await itemRepository.countPaymentLines(itemId);

  if (usedInPayments > 0) {
    throw new BadRequestException(
      'Este item já foi usado em pagamentos e não pode ser apagado — desativa-o em vez disso',
    );
  }

  await itemRepository.delete(itemId);
}
