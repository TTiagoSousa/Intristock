import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client/client';
import { NotificationActionStatus, NotificationKind } from './repositories/notification-repository';
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

  /** Um aviso a umas contas em concreto; com `action`, fica à espera de resposta (`pending`). */
  send(userIds: string[], kind: NotificationKind, data: Prisma.InputJsonValue, link: string | null, action = false) {
    return this.repository.createMany({ userIds, kind, data, link, actionStatus: action ? 'pending' : null });
  }

  /** Fecha os avisos com resposta pendente sobre uma coisa (ver o repositório). */
  closeActions(kind: NotificationKind, key: string, id: string, status: NotificationActionStatus) {
    return this.repository.closeActions(kind, key, id, status);
  }

  /** Desfaz um `closeActions` quando o que vinha a seguir falhou. */
  reopenActions(kind: NotificationKind, key: string, id: string, fromStatus: NotificationActionStatus) {
    return this.repository.reopenActions(kind, key, id, fromStatus);
  }

  /** Se há avisos à espera de resposta sobre uma coisa. */
  hasPendingAction(kind: NotificationKind, key: string, id: string) {
    return this.repository.hasPendingAction(kind, key, id);
  }
}
