import { FindNotificationsQueryDto } from '../dto/find-notifications-query.dto';
import { PrismaNotificationRepository } from '../repositories/prisma/prisma-notification-repository';

const DEFAULT_TAKE = 20;

// Os avisos do utilizador, dos mais recentes para trás, e quantos estão por ler
export async function findNotifications(
  userId: string,
  query: FindNotificationsQueryDto,
  repository: PrismaNotificationRepository,
) {
  const [items, unread] = await Promise.all([
    repository.findMany(userId, query.take ?? DEFAULT_TAKE),
    repository.countUnread(userId),
  ]);
  return { items, unread };
}
