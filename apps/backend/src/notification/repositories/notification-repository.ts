import { Notification, Prisma } from 'src/generated/prisma/client/client';

export type NotificationKind = 'version_installed' | 'version_available';

export interface CreateNotificationsInput {
  userIds: string[];
  kind: NotificationKind;
  data: Prisma.InputJsonValue;
  link: string | null;
}

export interface NotificationRepository {
  findMany(userId: string, take: number): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  markRead(id: string, userId: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  findUserIds(adminsOnly: boolean): Promise<string[]>;
  createMany(input: CreateNotificationsInput): Promise<number>;
}
