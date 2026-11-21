import { NotFoundException } from '@nestjs/common';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import {
  COMPANY_PERMISSIONS,
  CompanyPermission,
  resolveMemberPermissions,
} from 'src/company/permissions/companyPermissions';

export interface CompanyAccess {
  owner: boolean;
  roleName: string | null;
  permissions: CompanyPermission[];
}

/**
 * O que o utilizador pode fazer nesta empresa: o dono tudo, um membro o do
 * cargo mais os ajustes. O frontend usa-o para esconder o que não pode; quem
 * decide é sempre o `assertCompanyAccess` em cada rota.
 */
export async function getMyCompanyAccess(
  userId: string,
  companyId: string,
  companyRepository: PrismaCompanyRepository,
): Promise<CompanyAccess> {
  const company = await companyRepository.findById(companyId);
  if (!company || company.status === 'deleted') throw new NotFoundException('Empresa não encontrada');

  if (company.createdById === userId) {
    return { owner: true, roleName: null, permissions: [...COMPANY_PERMISSIONS] };
  }

  const member = await companyRepository.findMember(companyId, userId);
  if (!member || member.status !== 'active') throw new NotFoundException('Empresa não encontrada');

  return { owner: false, roleName: member.role?.name ?? null, permissions: resolveMemberPermissions(member) };
}
