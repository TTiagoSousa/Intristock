import { PrismaNotificationRepository } from '../repositories/prisma/prisma-notification-repository';

// Marca todos os avisos do utilizador como lidos
export async function markAllNotificationsRead(
  userId: string,
  repository: PrismaNotificationRepository,
) {
  await repository.markAllRead(userId);
  return { unread: 0 };
}
