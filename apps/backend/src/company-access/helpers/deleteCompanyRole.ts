import { ConflictException, NotFoundException } from '@nestjs/common';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyAccessRepository } from '../repositories/prisma/prisma-company-access-repository';

/** Um cargo em uso não se apaga: os membros ficavam sem acesso sem ninguém dar por isso. */
export async function deleteCompanyRole(
  userId: string,
  companyId: string,
  roleId: string,
  companyRepository: PrismaCompanyRepository,
  accessRepository: PrismaCompanyAccessRepository,
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes apagar cargos de uma empresa que não é tua',
    permission: 'members.manage',
  });

  const role = await accessRepository.findRole(companyId, roleId);
  if (!role) throw new NotFoundException('Cargo não encontrado');

  const members = await accessRepository.countRoleMembers(roleId);
  if (members > 0) {
    const who = members === 1 ? '1 membro tem' : `${members} membros têm`;
    throw new ConflictException(`${who} o cargo "${role.name}" — muda-lhes o cargo primeiro`);
  }

  await accessRepository.deleteRole(roleId);
}
