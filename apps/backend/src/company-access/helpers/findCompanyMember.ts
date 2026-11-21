import { NotFoundException } from '@nestjs/common';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyAccessRepository } from '../repositories/prisma/prisma-company-access-repository';
import { getMyCompanyAccess } from './getMyCompanyAccess';

// Os dados pessoais de um membro: só os vê quem trata dos salários ou gere os membros
// (e a própria pessoa); com só `members.view` vêm a nulo
const PERSONAL_FIELDS = [
  'taxNumber',
  'socialSecurityNumber',
  'idDocumentNumber',
  'birthDate',
  'addressLine',
  'postalCode',
  'city',
  'iban',
] as const;
const PERSONAL_DATA_PERMISSIONS = ['salaries.view', 'members.manage'];

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

  const access = await getMyCompanyAccess(userId, companyId, companyRepository);
  const seesPersonalData =
    access.owner ||
    member.userId === userId ||
    access.permissions.some((p) => PERSONAL_DATA_PERMISSIONS.includes(p));
  if (seesPersonalData) return { ...member, personalDataHidden: false };

  const hidden = { ...member, personalDataHidden: true };
  for (const field of PERSONAL_FIELDS) hidden[field] = null;
  return hidden;
}
