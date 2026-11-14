import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaCompanySupplierGroupRepository } from '../repositories/prisma/prisma-company-supplier-group-repository';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { SetCompanySupplierGroupSuppliersDto } from '../dto/set-company-supplier-group-suppliers.dto';

export async function setCompanySupplierGroupSuppliers(
  userId: string,
  companyId: string,
  groupId: string,
  dto: SetCompanySupplierGroupSuppliersDto,
  companySupplierGroupRepository: PrismaCompanySupplierGroupRepository,
  companyRepository: PrismaCompanyRepository,
) {
  // 1. A empresa tem de existir e pertencer a quem está a pedir
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes gerir grupos de uma empresa que não é tua',
    permission: 'suppliers.edit',
  });

  // 2. O grupo tem de existir e ser mesmo desta empresa
  const group = await companySupplierGroupRepository.findById(groupId);

  if (!group || group.companyId !== companyId) {
    throw new NotFoundException('Grupo não encontrado');
  }

  // 3. Todos os fornecedores pedidos têm de existir e ser da mesma empresa
  const supplierIds = dto.supplierIds;

  if (supplierIds.length > 0) {
    const suppliers =
      await companySupplierGroupRepository.findSuppliersByIds(supplierIds);

    for (const supplierId of supplierIds) {
      const supplier = suppliers.find((item) => item.id === supplierId);

      if (!supplier || supplier.companyId !== companyId) {
        throw new BadRequestException(`Fornecedor inválido: "${supplierId}"`);
      }
    }
  }

  // 4. Substituir o conjunto de fornecedores do grupo
  return companySupplierGroupRepository.setSuppliers(groupId, supplierIds);
}
