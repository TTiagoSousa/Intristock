import { NotFoundException } from '@nestjs/common';
import { PrismaCompanySupplierRepository } from '../repositories/prisma/prisma-company-supplier-repository';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';

// Um fornecedor pelo slug do URL (…/fornecedores/iq-capital), para a página de editar
export async function findCompanySupplierBySlug(
  userId: string,
  companyId: string,
  slug: string,
  companySupplierRepository: PrismaCompanySupplierRepository,
  companyRepository: PrismaCompanyRepository,
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes ver os fornecedores de uma empresa que não é tua',
    permission: 'suppliers.view',
  });

  const supplier = await companySupplierRepository.findBySlug(companyId, slug);

  if (!supplier) {
    throw new NotFoundException('Fornecedor não encontrado');
  }

  return supplier;
}
