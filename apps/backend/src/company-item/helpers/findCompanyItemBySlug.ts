import { NotFoundException } from '@nestjs/common';
import { PrismaCompanyItemRepository } from '../repositories/prisma/prisma-company-item-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { assertCompanyOwnership } from './assertItemInput';

// Um item pelo slug do URL (…/itens/filamento-pla), para a página de editar
export async function findCompanyItemBySlug(
  userId: string,
  companyId: string,
  slug: string,
  itemRepository: PrismaCompanyItemRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertCompanyOwnership(userId, companyId, companyRepository, 'items.view');

  const item = await itemRepository.findBySlug(companyId, slug);

  if (!item) {
    throw new NotFoundException('Item não encontrado');
  }

  return item;
}
