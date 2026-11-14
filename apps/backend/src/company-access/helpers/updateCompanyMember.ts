import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyAccessRepository } from '../repositories/prisma/prisma-company-access-repository';
import { UpdateCompanyMemberDto } from '../dto/company-member.dto';
import { assertCanGrant } from './assertCanGrant';
import { buildMemberProfile } from './buildMemberProfile';
import { getMyCompanyAccess } from './getMyCompanyAccess';

/**
 * Os dados de um membro e, se tem conta, o cargo e os ajustes dele (o que tem a
 * mais e o que lhe é tirado). Os próprios dados mudam-se; o próprio cargo não.
 */
export async function updateCompanyMember(
  userId: string,
  companyId: string,
  memberId: string,
  dto: UpdateCompanyMemberDto,
  companyRepository: PrismaCompanyRepository,
  accessRepository: PrismaCompanyAccessRepository,
) {
  await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes editar membros de uma empresa que não é tua',
    permission: 'members.manage',
  });

  const member = await accessRepository.findMemberById(companyId, memberId);
  if (!member) throw new NotFoundException('Membro não encontrado');

  const profile = await buildMemberProfile(companyId, dto, accessRepository);
  if (!member.userId && profile.name === null) {
    throw new BadRequestException('Um membro sem conta precisa de um nome');
  }

  const touchesAccess =
    dto.roleId !== undefined || dto.extraPermissions !== undefined || dto.deniedPermissions !== undefined;
  if (!touchesAccess) return accessRepository.updateMember(memberId, profile);

  if (!member.userId) {
    throw new BadRequestException('Um membro sem conta não entra na app, por isso não tem cargo nem permissões');
  }
  if (member.userId === userId) {
    throw new ForbiddenException('Não podes mudar o teu próprio cargo nem as tuas permissões');
  }

  const extra = dto.extraPermissions ?? member.extraPermissions;
  const denied = dto.deniedPermissions ?? member.deniedPermissions;
  if (extra.some((p) => denied.includes(p))) {
    throw new BadRequestException('Uma permissão não pode estar a mais e tirada ao mesmo tempo');
  }

  const access = await getMyCompanyAccess(userId, companyId, companyRepository);
  if (dto.roleId) {
    const role = await accessRepository.findRole(companyId, dto.roleId);
    if (!role) throw new NotFoundException('Cargo não encontrado');
    if (dto.roleId !== member.roleId) assertCanGrant(access, role.permissions);
  }
  if (dto.extraPermissions) {
    assertCanGrant(access, dto.extraPermissions.filter((p) => !member.extraPermissions.includes(p)));
  }

  return accessRepository.updateMember(memberId, {
    ...profile,
    ...(dto.roleId !== undefined ? { roleId: dto.roleId } : {}),
    ...(dto.extraPermissions ? { extraPermissions: dto.extraPermissions } : {}),
    ...(dto.deniedPermissions ? { deniedPermissions: dto.deniedPermissions } : {}),
  });
}
