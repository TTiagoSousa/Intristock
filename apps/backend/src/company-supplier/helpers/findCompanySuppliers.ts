import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaCompanySupplierRepository } from '../repositories/prisma/prisma-company-supplier-repository';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';

export async function findCompanySuppliers(
  userId: string,
  companyId: string,
  companySupplierRepository: PrismaCompanySupplierRepository,
  companyRepository: PrismaCompanyRepository,
  pagination: { skip: number; take: number },
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes ver os fornecedores de uma empresa que não é tua',
    permission: ['suppliers.view', 'payments.view', 'items.view'],
  });

  return companySupplierRepository.findPageByCompanyId(companyId, pagination);
}
