import { Prisma } from 'src/generated/prisma/client/client';
import { NotificationKind } from '../repositories/notification-repository';
import { PrismaNotificationRepository } from '../repositories/prisma/prisma-notification-repository';

export interface NotifyUsersInput {
  kind: NotificationKind;
  data: Prisma.InputJsonValue;
  link: string | null;
  adminsOnly: boolean;
}

// Cria o mesmo aviso para todos os utilizadores ativos (ou só os administradores)
export async function notifyUsers(
  input: NotifyUsersInput,
  repository: PrismaNotificationRepository,
) {
  const userIds = await repository.findUserIds(input.adminsOnly);
  return repository.createMany({
    userIds,
    kind: input.kind,
    data: input.data,
    link: input.link,
  });
}
