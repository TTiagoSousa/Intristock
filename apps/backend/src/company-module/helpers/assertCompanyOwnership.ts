import { assertCompanyAccess, CompanyAccessPermission } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';

// Mesma regra do resto da app: o dono pode tudo, um membro o que o cargo lhe dá
export async function assertCompanyOwnership(
  userId: string,
  companyId: string,
  companyRepository: PrismaCompanyRepository,
  // O que é preciso (`assertCompanyAccess`): ver lê, o resto grava
  permission: CompanyAccessPermission,
) {
  return assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes gerir os módulos de uma empresa que não é tua',
    permission,
  });
}
