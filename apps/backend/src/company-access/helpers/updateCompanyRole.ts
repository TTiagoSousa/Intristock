import { ConflictException, NotFoundException } from '@nestjs/common';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyAccessRepository } from '../repositories/prisma/prisma-company-access-repository';
import { UpdateCompanyRoleDto } from '../dto/company-role.dto';
import { assertCanGrant } from './assertCanGrant';
import { getMyCompanyAccess } from './getMyCompanyAccess';

/** Mudar as permissões de um cargo muda-as logo a todos os membros que o têm. */
export async function updateCompanyRole(
  userId: string,
  companyId: string,
  roleId: string,
  dto: UpdateCompanyRoleDto,
  companyRepository: PrismaCompanyRepository,
  accessRepository: PrismaCompanyAccessRepository,
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes editar cargos de uma empresa que não é tua',
    permission: 'members.manage',
  });

  const role = await accessRepository.findRole(companyId, roleId);
  if (!role) throw new NotFoundException('Cargo não encontrado');

  if (dto.permissions) {
    // Só conta o que se acrescenta: o que o cargo já tinha pode ficar
    const access = await getMyCompanyAccess(userId, companyId, companyRepository);
    assertCanGrant(access, dto.permissions.filter((p) => !role.permissions.includes(p)));
  }

  const name = dto.name?.trim();
  if (name && name.toLowerCase() !== role.name.toLowerCase()) {
    if (await accessRepository.findRoleByName(companyId, name)) {
      throw new ConflictException(`Já há um cargo "${name}" nesta empresa`);
    }
  }

  return accessRepository.updateRole(roleId, {
    ...(name ? { name } : {}),
    ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
    ...(dto.permissions ? { permissions: dto.permissions } : {}),
  });
}
