import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyAccessRepository } from '../repositories/prisma/prisma-company-access-repository';

/**
 * Tirar um membro. Com conta e com histórico (salários, contratos, documentos,
 * pagamentos) perde só o acesso: fica como membro sem conta, sem cargo. Sem
 * histórico sai de vez. Um membro sem conta só se apaga sem histórico — os
 * salários, os contratos e os documentos tiram-se primeiro, e com pagamentos
 * não se apaga.
 */
export async function removeCompanyMember(
  userId: string,
  companyId: string,
  memberId: string,
  companyRepository: PrismaCompanyRepository,
  accessRepository: PrismaCompanyAccessRepository,
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes tirar membros de uma empresa que não é tua',
    permission: 'members.manage',
  });

  const member = await accessRepository.findMemberById(companyId, memberId);
  if (!member) throw new NotFoundException('Membro não encontrado');
  if (member.userId === userId) throw new ForbiddenException('Não te podes tirar a ti próprio da empresa');

  const history = await accessRepository.countMemberHistory(memberId);
  const hasHistory = history.pays + history.contracts + history.documents + history.payments > 0;

  if (member.userId && hasHistory) {
    await accessRepository.updateMember(memberId, {
      userId: null,
      roleId: null,
      extraPermissions: [],
      deniedPermissions: [],
    });
    return;
  }

  if (hasHistory) {
    throw new ConflictException(
      history.payments > 0
        ? 'Este membro tem pagamentos registados e não se pode apagar'
        : 'Tira primeiro os salários, os contratos e os documentos deste membro',
    );
  }

  await accessRepository.deleteMember(memberId);
}
