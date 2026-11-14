import { ConflictException } from '@nestjs/common';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyAccessRepository } from '../repositories/prisma/prisma-company-access-repository';
import { CreateCompanyRoleDto } from '../dto/company-role.dto';
import { assertCanGrant } from './assertCanGrant';
import { getMyCompanyAccess } from './getMyCompanyAccess';

export async function createCompanyRole(
  userId: string,
  companyId: string,
  dto: CreateCompanyRoleDto,
  companyRepository: PrismaCompanyRepository,
  accessRepository: PrismaCompanyAccessRepository,
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes criar cargos numa empresa que não é tua',
    permission: 'members.manage',
  });
  assertCanGrant(await getMyCompanyAccess(userId, companyId, companyRepository), dto.permissions);

  const name = dto.name.trim();
  if (await accessRepository.findRoleByName(companyId, name)) {
    throw new ConflictException(`Já há um cargo "${name}" nesta empresa`);
  }

  return accessRepository.createRole(companyId, {
    name,
    description: dto.description?.trim() || null,
    permissions: dto.permissions,
  });
}
