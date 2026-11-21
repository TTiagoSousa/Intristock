import { NotificationService } from 'src/notification/notification.service';
import { PrismaCompanyInvitationRepository } from '../repositories/prisma/prisma-company-invitation-repository';

/** Uma conta foi convidada para a empresa: recebe o aviso `company_invite` para aceitar ou recusar. */
export async function notifyCompanyInvite(
  memberId: string,
  actorId: string,
  repository: PrismaCompanyInvitationRepository,
  notifications: NotificationService,
) {
  const member = await repository.findMember(memberId);
  if (!member?.userId || member.status !== 'invited') return 0;
  const actor = await repository.findUserName(actorId);
  return notifications.send(
    [member.userId],
    'company_invite',
    {
      memberId: member.id,
      companyId: member.company.id,
      companyName: member.company.name,
      roleName: member.role?.name ?? null,
      invitedBy: actor?.fullName ?? null,
    },
    '/Convites',
    true,
  );
}
