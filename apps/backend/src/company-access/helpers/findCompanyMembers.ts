import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { resolveMemberPermissions } from 'src/company/permissions/companyPermissions';
import { PrismaUserRepository } from 'src/user/repositories/prisma/prisma-user-repository';

/** O dono e os membros, cada um com o cargo e as permissões que tem no fim. */
export async function findCompanyMembers(
  userId: string,
  companyId: string,
  companyRepository: PrismaCompanyRepository,
  userRepository: PrismaUserRepository,
) {
  const company = await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes ver os membros de uma empresa que não é tua',
    permission: 'members.view',
  });

  const [owner, members] = await Promise.all([
    userRepository.findById(company.createdById),
    companyRepository.findMembersByCompanyId(companyId),
  ]);

  return {
    owner: owner ? { id: owner.id, email: owner.email, fullName: owner.fullName } : null,
    members: members.map((member) => ({
      id: member.id,
      // Sem conta o `user` vem nulo: o nome e o email são os dos dados
      user: member.user,
      name: member.name ?? member.user?.fullName ?? '',
      email: member.email ?? member.user?.email ?? null,
      jobTitle: member.jobTitle,
      role: member.role ? { id: member.role.id, name: member.role.name } : null,
      extraPermissions: member.extraPermissions,
      deniedPermissions: member.deniedPermissions,
      permissions: resolveMemberPermissions(member),
      // invited | active | declined (os convites por aceitar ainda não entram)
      status: member.status,
      createdAt: member.createdAt,
    })),
  };
}
