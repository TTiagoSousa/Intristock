import { Injectable } from '@nestjs/common';
import { FindNotificationsQueryDto } from './dto/find-notifications-query.dto';
import { findNotifications } from './helpers/findNotifications';
import { markAllNotificationsRead } from './helpers/markAllNotificationsRead';
import { markNotificationRead } from './helpers/markNotificationRead';
import { notifyUsers, NotifyUsersInput } from './helpers/notifyUsers';
import { PrismaNotificationRepository } from './repositories/prisma/prisma-notification-repository';

@Injectable()
export class NotificationService {
  constructor(private readonly repository: PrismaNotificationRepository) {}

  findAll(userId: string, query: FindNotificationsQueryDto) {
    return findNotifications(userId, query, this.repository);
  }

  markRead(userId: string, id: string) {
    return markNotificationRead(userId, id, this.repository);
  }

  markAllRead(userId: string) {
    return markAllNotificationsRead(userId, this.repository);
  }

  // Para os outros módulos (as versões) avisarem os utilizadores
  notify(input: NotifyUsersInput) {
    return notifyUsers(input, this.repository);
  }
}
