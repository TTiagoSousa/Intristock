import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { resolveMemberPermissions } from 'src/company/permissions/companyPermissions';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';

export const DATA_MODULE = 'call_center';

/// As permissões das rotas do call center (os Dados e as Leads)
export type CallCenterPermission = 'data.view' | 'data.manage' | 'leads.view' | 'leads.work' | 'leads.manage';

/**
 * O acesso ao call center (os Dados e as Leads): o módulo ligado e a permissão da rota.
 * Devolve também se quem pede vê as colunas pessoais (`data.personal`; o dono vê).
 */
export async function assertDataAccess(
  userId: string,
  companyId: string,
  companyRepository: PrismaCompanyRepository,
  permission: CallCenterPermission,
  notYours = 'Não tens acesso aos dados desta empresa',
) {
  const company = await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours,
    permission,
    module: DATA_MODULE,
  });

  let canSeePersonal = company.createdById === userId;
  if (!canSeePersonal) {
    const member = await companyRepository.findMember(companyId, userId);
    canSeePersonal = !!member && resolveMemberPermissions(member).includes('data.personal');
  }

  return { company, canSeePersonal };
}
