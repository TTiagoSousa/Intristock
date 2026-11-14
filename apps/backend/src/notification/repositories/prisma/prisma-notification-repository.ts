import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateNotificationsInput,
  NotificationRepository,
} from '../notification-repository';

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(userId: string, take: number) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async countUnread(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(id: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  // Os utilizadores ativos (só os administradores, com `adminsOnly`)
  async findUserIds(adminsOnly: boolean) {
    const users = await this.prisma.user.findMany({
      where: { active: true, ...(adminsOnly ? { role: 'ADMIN' } : {}) },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  async createMany({ userIds, kind, data, link }: CreateNotificationsInput) {
    if (!userIds.length) return 0;
    const { count } = await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, kind, data, link })),
    });
    return count;
  }
}
