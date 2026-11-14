import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyAccessRepository } from '../repositories/prisma/prisma-company-access-repository';

export async function findCompanyRoles(
  userId: string,
  companyId: string,
  companyRepository: PrismaCompanyRepository,
  accessRepository: PrismaCompanyAccessRepository,
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes ver os cargos de uma empresa que não é tua',
    permission: 'members.view',
  });

  const roles = await accessRepository.findRoles(companyId);
  return roles.map(({ _count, ...role }) => ({ ...role, memberCount: _count.members }));
}
