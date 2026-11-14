import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { assertCompanyAccess } from 'src/company/helpers/assertCompanyAccess';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaUserRepository } from 'src/user/repositories/prisma/prisma-user-repository';
import { PrismaCompanyAccessRepository } from '../repositories/prisma/prisma-company-access-repository';
import { AddCompanyMemberDto } from '../dto/company-member.dto';
import { assertCanGrant } from './assertCanGrant';
import { buildMemberProfile } from './buildMemberProfile';
import { getMyCompanyAccess } from './getMyCompanyAccess';

/**
 * Junta um membro à empresa: com `accountEmail`, um utilizador da instalação
 * (com um cargo ou sem nenhum); sem ele, uma pessoa sem conta — só um registo,
 * com o nome obrigatório e sem cargo. Os dados da pessoa vão nos dois.
 */
export async function addCompanyMember(
  userId: string,
  companyId: string,
  dto: AddCompanyMemberDto,
  companyRepository: PrismaCompanyRepository,
  userRepository: PrismaUserRepository,
  accessRepository: PrismaCompanyAccessRepository,
) {
  const company = await assertCompanyAccess(userId, companyId, companyRepository, {
    notYours: 'Não podes adicionar membros a uma empresa que não é tua',
    permission: 'members.manage',
  });

  const profile = await buildMemberProfile(companyId, dto, accessRepository);

  if (!dto.accountEmail) {
    if (!profile.name || profile.name.length < 2) {
      throw new BadRequestException('Um membro sem conta precisa de um nome');
    }
    if (dto.roleId) {
      throw new BadRequestException('Um membro sem conta não entra na app, por isso não tem cargo');
    }
    return accessRepository.createRecordMember(companyId, profile);
  }

  const target = await userRepository.findByEmail(dto.accountEmail.trim().toLowerCase());
  if (!target) throw new NotFoundException('Não há nenhum utilizador com esse email');

  if (target.id === company.createdById) {
    throw new BadRequestException('O dono da empresa já tem acesso a tudo');
  }
  if (await companyRepository.findMember(companyId, target.id)) {
    throw new ConflictException('Esse utilizador já é membro desta empresa');
  }

  if (dto.roleId) {
    const role = await accessRepository.findRole(companyId, dto.roleId);
    if (!role) throw new NotFoundException('Cargo não encontrado');
    assertCanGrant(await getMyCompanyAccess(userId, companyId, companyRepository), role.permissions);
  }

  const member = await companyRepository.addMember({ companyId, userId: target.id });
  return accessRepository.updateMember(member.id, {
    ...profile,
    ...(dto.roleId ? { roleId: dto.roleId } : {}),
  });
}
