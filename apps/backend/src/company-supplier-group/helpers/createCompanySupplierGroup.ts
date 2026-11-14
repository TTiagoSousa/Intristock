import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaCompanySupplierGroupRepository } from '../repositories/prisma/prisma-company-supplier-group-repository';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { CreateCompanySupplierGroupDto } from '../dto/create-company-supplier-group.dto';

export async function createCompanySupplierGroup(
  userId: string,
  companyId: string,
  dto: CreateCompanySupplierGroupDto,
  companySupplierGroupRepository: PrismaCompanySupplierGroupRepository,
  companyRepository: PrismaCompanyRepository,
) {
  // 1. A empresa tem de existir e pertencer a quem está a pedir
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes criar grupos numa empresa que não é tua',
    permission: 'suppliers.create',
  });

  // 2. O nome do grupo é único dentro da empresa
  const existing = await companySupplierGroupRepository.findByCompanyIdAndName(
    companyId,
    dto.name,
  );

  if (existing) {
    throw new ConflictException('Já existe um grupo com este nome');
  }

  // 3. Criar
  return companySupplierGroupRepository.create({ ...dto, companyId });
}
