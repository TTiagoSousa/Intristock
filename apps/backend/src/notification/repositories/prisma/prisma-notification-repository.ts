import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateNotificationsInput,
  NotificationActionStatus,
  NotificationKind,
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

  async createMany({ userIds, kind, data, link, actionStatus }: CreateNotificationsInput) {
    if (!userIds.length) return 0;
    const { count } = await this.prisma.notification.createMany({
      data: [...new Set(userIds)].map((userId) => ({ userId, kind, data, link, actionStatus: actionStatus ?? null })),
    });
    return count;
  }

  /**
   * Fecha os avisos que pediam resposta sobre uma coisa (pelo campo `key` = `id` dos dados):
   * respondidos, cancelados ou já feitos. Ficam lidos.
   */
  async closeActions(kind: NotificationKind, key: string, id: string, actionStatus: NotificationActionStatus) {
    // Devolve quantos fecharam: com 0, outro pedido já tinha respondido (quem confirma usa-o
    // como trinco, porque passar de `pending` a outro estado é atómico)
    const { count } = await this.prisma.notification.updateMany({
      where: { kind, actionStatus: 'pending', data: { path: [key], equals: id } },
      data: { actionStatus, readAt: new Date() },
    });
    return count;
  }

  /** Volta a pôr em `pending` os avisos fechados com um estado (quando o que se seguia falhou). */
  async reopenActions(kind: NotificationKind, key: string, id: string, fromStatus: NotificationActionStatus) {
    await this.prisma.notification.updateMany({
      where: { kind, actionStatus: fromStatus, data: { path: [key], equals: id } },
      data: { actionStatus: 'pending', readAt: null },
    });
  }

  /** Se há avisos à espera de resposta sobre uma coisa. */
  async hasPendingAction(kind: NotificationKind, key: string, id: string) {
    const count = await this.prisma.notification.count({
      where: { kind, actionStatus: 'pending', data: { path: [key], equals: id } },
    });
    return count > 0;
  }
}
