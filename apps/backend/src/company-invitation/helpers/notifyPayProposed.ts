import { isoDayOrNull as day } from 'src/utils/dates';
import { NotificationService } from 'src/notification/notification.service';
import { PrismaCompanyInvitationRepository } from '../repositories/prisma/prisma-company-invitation-repository';
import { payProposalResponder } from './payProposalResponder';


/** Uma proposta de salário ou recibo verde a um membro com conta: recebe `member_pay_proposed`. */
export async function notifyPayProposed(
  payId: string,
  repository: PrismaCompanyInvitationRepository,
  notifications: NotificationService,
) {
  const pay = await repository.findPay(payId);
  if (!pay?.member.userId || pay.status !== 'proposed') return 0;
  // O membro, ou o dono quando foi o membro a propor o próprio salário
  const responder = payProposalResponder(pay);
  if (!responder) return 0;
  return notifications.send(
    [responder],
    'member_pay_proposed',
    {
      payId: pay.id,
      companyId: pay.member.company.id,
      companyName: pay.member.company.name,
      kind: pay.kind,
      grossAmount: Number(pay.grossAmount),
      currency: pay.member.currency?.shortCode ?? pay.member.company.currency.shortCode,
      paymentsPerYear: pay.paymentsPerYear,
      startDate: day(pay.startDate),
      dueDate: day(pay.dueDate),
      previousAmount: pay.replaces ? Number(pay.replaces.grossAmount) : null,
    },
    '/Convites',
    true,
  );
}
