import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaCompanySupplierGroupRepository } from '../repositories/prisma/prisma-company-supplier-group-repository';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';

export async function findCompanySupplierGroups(
  userId: string,
  companyId: string,
  companySupplierGroupRepository: PrismaCompanySupplierGroupRepository,
  companyRepository: PrismaCompanyRepository,
  pagination: { skip: number; take: number },
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes ver os grupos de uma empresa que não é tua',
    permission: ['suppliers.view', 'payments.view'],
  });

  return companySupplierGroupRepository.findPageByCompanyId(companyId, pagination);
}
