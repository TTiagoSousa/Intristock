import { NotificationService } from 'src/notification/notification.service';
import { PrismaCompanyInvitationRepository } from '../repositories/prisma/prisma-company-invitation-repository';
import { incomeFromMemberPayment } from './incomeFromMemberPayment';

/**
 * A empresa registou um pagamento a um membro com conta. Se quem pagou é o próprio membro
 * (paga-se a si mesmo), o ganho entra já, confirmado; senão a pessoa recebe `member_paid` para
 * confirmar que recebeu (ou dizer que não).
 */
export async function onMemberPaid(
  paymentId: string,
  actorId: string,
  repository: PrismaCompanyInvitationRepository,
  notifications: NotificationService,
) {
  const payment = await repository.findMemberPayment(paymentId);
  const userId = payment?.member?.userId;
  if (!payment || !userId || payment.partyType !== 'member' || payment.status !== 'completed') return null;

  if (userId === actorId) {
    // Um ganho por pagamento (`companyPaymentId` é único): se já existe, fica esse
    const exists = await repository.findIncomeOfPayment(payment);
    return exists ?? repository.createIncome(incomeFromMemberPayment(userId, payment));
  }

  // Já pediu confirmação (um rascunho que volta a concluído): não se pede outra vez
  if (await notifications.hasPendingAction('member_paid', 'paymentId', payment.id)) return null;
  if (await repository.findIncomeOfPayment(payment)) return null;

  await notifications.send(
    [userId],
    'member_paid',
    {
      source: 'company_payment',
      paymentId: payment.id,
      companyId: payment.company.id,
      companyName: payment.company.name,
      kind: payment.memberPay?.kind ?? null,
      period: payment.memberPayPeriod,
      amount: Number(payment.amount),
      currency: payment.currency.shortCode,
      date: payment.paymentDate.toISOString().slice(0, 10),
    },
    '/Convites',
    true,
  );
  return null;
}
