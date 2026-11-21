import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationService } from 'src/notification/notification.service';
import { PrismaCompanyInvitationRepository } from '../repositories/prisma/prisma-company-invitation-repository';

/**
 * A pessoa aceita (entra na empresa, com o cargo que lhe deram) ou recusa um convite. Quem gere
 * os membros recebe a resposta (`company_invite_answered`).
 */
export async function respondCompanyInvite(
  userId: string,
  memberId: string,
  accept: boolean,
  repository: PrismaCompanyInvitationRepository,
  notifications: NotificationService,
) {
  const member = await repository.findMember(memberId);
  if (!member || member.userId !== userId) throw new NotFoundException('Convite não encontrado');
  if (member.status !== 'invited') throw new BadRequestException('Este convite já foi respondido');

  await repository.updateMember(member.id, { status: accept ? 'active' : 'declined', respondedAt: new Date() });
  await notifications.closeActions('company_invite', 'memberId', member.id, accept ? 'accepted' : 'declined');
  const managers = (await repository.findManagerUserIds(member.company.id, ['members.manage'])).filter(
    (id) => id !== userId,
  );
  await notifications.send(
    managers,
    'company_invite_answered',
    {
      memberId: member.id,
      companyId: member.company.id,
      companyName: member.company.name,
      userName: member.user?.fullName ?? null,
      accepted: accept,
    },
    `/Companies/${member.company.slug}/membros`,
  );
  return { id: member.id, status: accept ? 'active' : 'declined', company: { slug: member.company.slug } };
}
