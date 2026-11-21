import { NotificationService } from 'src/notification/notification.service';
import { PrismaTimeTrackingRepository } from '../repositories/prisma/prisma-time-tracking-repository';

/**
 * A empresa pagou horas a outra pessoa: ela recebe `member_paid` (com o `payoutId`) para confirmar
 * que recebeu; o ganho pessoal só se cria quando confirma.
 */
export async function notifyPayoutPaid(
  payoutId: string,
  repository: PrismaTimeTrackingRepository,
  notifications: NotificationService,
) {
  const payout = await repository.findPayoutView(payoutId);
  if (!payout?.userId) return 0;
  return notifications.send(
    [payout.userId],
    'member_paid',
    {
      source: 'time_tracking',
      payoutId: payout.id,
      companyId: payout.company.id,
      companyName: payout.company.name,
      seconds: payout.seconds,
      amount: Number(payout.netAmount),
      currency: payout.currency.shortCode,
      date: payout.paidAt.toISOString().slice(0, 10),
    },
    '/Convites',
    true,
  );
}
