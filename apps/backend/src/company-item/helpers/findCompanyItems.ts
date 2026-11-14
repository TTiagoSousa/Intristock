import { PrismaCompanyItemRepository } from '../repositories/prisma/prisma-company-item-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { assertCompanyOwnership } from './assertItemInput';

export async function findCompanyItems(
  userId: string,
  companyId: string,
  itemRepository: PrismaCompanyItemRepository,
  companyRepository: PrismaCompanyRepository,
  pagination: { skip: number; take: number },
) {
  await assertCompanyOwnership(userId, companyId, companyRepository, ['items.view', 'payments.view', 'stock.view', 'assets.view']);

  // Devolve ativos e inativos — quem filtra é o frontend
  return itemRepository.findPageByCompanyId(companyId, pagination);
}
