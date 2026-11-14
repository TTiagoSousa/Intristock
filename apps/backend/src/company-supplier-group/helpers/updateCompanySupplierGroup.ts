import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaCompanySupplierGroupRepository } from '../repositories/prisma/prisma-company-supplier-group-repository';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { UpdateCompanySupplierGroupDto } from '../dto/update-company-supplier-group.dto';

export async function updateCompanySupplierGroup(
  userId: string,
  companyId: string,
  groupId: string,
  dto: UpdateCompanySupplierGroupDto,
  companySupplierGroupRepository: PrismaCompanySupplierGroupRepository,
  companyRepository: PrismaCompanyRepository,
) {
  // 1. A empresa tem de existir e pertencer a quem está a pedir
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes editar grupos de uma empresa que não é tua',
    permission: 'suppliers.edit',
  });

  // 2. O grupo tem de existir e ser mesmo desta empresa
  const group = await companySupplierGroupRepository.findById(groupId);

  if (!group || group.companyId !== companyId) {
    throw new NotFoundException('Grupo não encontrado');
  }

  // 3. Se mudar de nome, não pode chocar com outro grupo da mesma empresa
  if (dto.name && dto.name !== group.name) {
    const existing =
      await companySupplierGroupRepository.findByCompanyIdAndName(
        companyId,
        dto.name,
      );

    if (existing && existing.id !== groupId) {
      throw new ConflictException('Já existe um grupo com este nome');
    }
  }

  // 4. Atualizar
  return companySupplierGroupRepository.update(groupId, dto);
}
