import { NotFoundException } from '@nestjs/common';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyAccessRepository } from '../repositories/prisma/prisma-company-access-repository';

/** Um membro com os dados dele, para a página do membro. */
export async function findCompanyMember(
  userId: string,
  companyId: string,
  memberId: string,
  companyRepository: PrismaCompanyRepository,
  accessRepository: PrismaCompanyAccessRepository,
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes ver os membros de uma empresa que não é tua',
    permission: 'members.view',
  });

  const member = await accessRepository.findMemberDetail(companyId, memberId);
  if (!member) throw new NotFoundException('Membro não encontrado');
  return member;
}
