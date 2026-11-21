import { Injectable } from '@nestjs/common';
import { NotificationService } from 'src/notification/notification.service';
import { PrismaCompanyInvitationRepository } from './repositories/prisma/prisma-company-invitation-repository';
import { PrismaTimeTrackingRepository } from 'src/time-tracking/repositories/prisma/prisma-time-tracking-repository';
import { findMyInvitations } from './helpers/findMyInvitations';
import { notifyCompanyInvite } from './helpers/notifyCompanyInvite';
import { respondCompanyInvite } from './helpers/respondCompanyInvite';
import { notifyPayProposed } from './helpers/notifyPayProposed';
import { respondPayProposal } from './helpers/respondPayProposal';
import { onMemberPaid } from './helpers/onMemberPaid';
import { confirmMemberPayment } from './helpers/confirmMemberPayment';

/**
 * Os convites para empresas, as propostas de salário e a confirmação dos pagamentos, do lado de
 * quem os recebe. Os membros, os salários e os pagamentos chamam os `notify…`/`on…` ao gravar.
 */
@Injectable()
export class CompanyInvitationService {
  constructor(
    private readonly repository: PrismaCompanyInvitationRepository,
    private readonly notifications: NotificationService,
    private readonly timeTracking: PrismaTimeTrackingRepository,
  ) {}

  mine(userId: string) {
    return findMyInvitations(userId, this.repository);
  }

  respondInvite(userId: string, memberId: string, accept: boolean) {
    return respondCompanyInvite(userId, memberId, accept, this.repository, this.notifications);
  }

  respondProposal(userId: string, payId: string, accept: boolean, note?: string) {
    return respondPayProposal(userId, payId, accept, note, this.repository, this.notifications);
  }

  confirmPayment(userId: string, source: 'company_payment' | 'time_tracking', id: string, received: boolean) {
    return confirmMemberPayment(userId, source, id, received, this.repository, this.notifications, this.timeTracking);
  }

  // --- para os outros módulos ---

  invited(memberId: string, actorId: string) {
    return notifyCompanyInvite(memberId, actorId, this.repository, this.notifications);
  }

  /** O convite saiu (o membro foi tirado antes de responder): o aviso deixa de pedir resposta. */
  inviteCancelled(memberId: string) {
    return this.notifications.closeActions('company_invite', 'memberId', memberId, 'cancelled');
  }

  payProposed(payId: string) {
    return notifyPayProposed(payId, this.repository, this.notifications);
  }

  proposalCancelled(payId: string) {
    return this.notifications.closeActions('member_pay_proposed', 'payId', payId, 'cancelled');
  }

  memberPaid(paymentId: string, actorId: string) {
    return onMemberPaid(paymentId, actorId, this.repository, this.notifications);
  }

  memberPaymentRemoved(paymentId: string) {
    return this.notifications.closeActions('member_paid', 'paymentId', paymentId, 'cancelled');
  }
}
