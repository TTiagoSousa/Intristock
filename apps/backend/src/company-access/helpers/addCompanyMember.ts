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
 * (com um cargo ou sem nenhum) — vai como convite (`invited`), que a pessoa aceita ou recusa
 * nos avisos, e só então entra; sem ele, uma pessoa sem conta — só um registo,
 * com o nome obrigatório e sem cargo. Os dados da pessoa vão nos dois. Quem recusou pode ser
 * convidado outra vez.
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

  // Sem conta com esse email devolve null: o service responde como a um convite feito,
  // para o formulário não servir para descobrir que contas há na instalação
  const target = await userRepository.findByEmail(dto.accountEmail.trim().toLowerCase());
  if (!target) return null;

  if (target.id === company.createdById) {
    throw new BadRequestException('O dono da empresa já tem acesso a tudo');
  }
  const existing = await companyRepository.findMember(companyId, target.id);
  if (existing && existing.status !== 'declined') {
    throw new ConflictException(
      existing.status === 'invited' ? 'Esse utilizador já foi convidado' : 'Esse utilizador já é membro desta empresa',
    );
  }

  if (dto.roleId) {
    const role = await accessRepository.findRole(companyId, dto.roleId);
    if (!role) throw new NotFoundException('Cargo não encontrado');
    assertCanGrant(await getMyCompanyAccess(userId, companyId, companyRepository), role.permissions);
  }

  const invite = { status: 'invited', invitedById: userId, invitedAt: new Date(), respondedAt: null };
  const member = existing ?? (await companyRepository.addMember({
      companyId,
      userId: target.id,
      status: invite.status,
      invitedById: invite.invitedById,
      invitedAt: invite.invitedAt,
    }));
  return accessRepository.updateMember(member.id, {
    ...profile,
    ...invite,
    ...(dto.roleId ? { roleId: dto.roleId } : {}),
  });
}
