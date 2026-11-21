import { Notification, Prisma } from 'src/generated/prisma/client/client';

export type NotificationKind =
  | 'version_installed'
  | 'version_available'
  // O último backup da VM falhou (só os admins)
  | 'backup_failed'
  // Convites para uma empresa e as respostas (a quem gere os membros)
  | 'company_invite'
  | 'company_invite_answered'
  // Propostas de salário ou recibo verde e as respostas (a quem gere os salários)
  | 'member_pay_proposed'
  | 'member_pay_answered'
  // A empresa registou que pagou (um salário, um recibo, horas): a pessoa confirma que recebeu
  | 'member_paid'
  | 'member_payment_confirmed';

/** O estado de um aviso que pede uma resposta (os outros ficam nulos). */
export type NotificationActionStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'done';

export interface CreateNotificationsInput {
  userIds: string[];
  kind: NotificationKind;
  data: Prisma.InputJsonValue;
  link: string | null;
  actionStatus?: NotificationActionStatus | null;
}

export interface NotificationRepository {
  findMany(userId: string, take: number): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  markRead(id: string, userId: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  findUserIds(adminsOnly: boolean): Promise<string[]>;
  createMany(input: CreateNotificationsInput): Promise<number>;
}
