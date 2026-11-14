import { NotFoundException } from '@nestjs/common';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyMemberRepository } from '../repositories/prisma/prisma-company-member-repository';

/**
 * A empresa com a permissão pedida (`salaries.view` para ler, `salaries.manage`
 * para gravar) e o membro, que tem de ser dela.
 */
export async function assertMemberAccess(
  userId: string,
  companyId: string,
  memberId: string,
  permission: 'salaries.view' | 'salaries.manage',
  companyRepository: PrismaCompanyRepository,
  memberRepository: PrismaCompanyMemberRepository,
) {
  const company = await assertCompanyAccess(
    userId,
    companyId,
    companyRepository,
    {
      notYours: 'Não podes ver os salários de uma empresa que não é tua',
      permission,
    },
  );

  const member = await memberRepository.findMember(companyId, memberId);
  if (!member) throw new NotFoundException('Membro não encontrado');

  return { company, member };
}
