import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaCompanySupplierGroupRepository } from '../repositories/prisma/prisma-company-supplier-group-repository';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';

export async function deleteCompanySupplierGroup(
  userId: string,
  companyId: string,
  groupId: string,
  companySupplierGroupRepository: PrismaCompanySupplierGroupRepository,
  companyRepository: PrismaCompanyRepository,
) {
  // 1. A empresa tem de existir e pertencer a quem está a pedir
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes apagar grupos de uma empresa que não é tua',
    permission: 'suppliers.delete',
  });

  // 2. O grupo tem de existir e ser mesmo desta empresa
  const group = await companySupplierGroupRepository.findById(groupId);

  if (!group || group.companyId !== companyId) {
    throw new NotFoundException('Grupo não encontrado');
  }

  // 3. Apagar — os fornecedores do grupo ficam sem grupo, não são apagados
  return companySupplierGroupRepository.delete(groupId);
}
