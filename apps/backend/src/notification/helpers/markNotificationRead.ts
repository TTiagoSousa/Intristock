import { PrismaNotificationRepository } from '../repositories/prisma/prisma-notification-repository';

// Marca um aviso como lido (só os do próprio; um já lido fica como estava)
export async function markNotificationRead(
  userId: string,
  id: string,
  repository: PrismaNotificationRepository,
) {
  await repository.markRead(id, userId);
  return { unread: await repository.countUnread(userId) };
}
