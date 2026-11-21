import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { NotificationService } from 'src/notification/notification.service';
import { PrismaCompanyInvitationRepository } from '../repositories/prisma/prisma-company-invitation-repository';
import { payProposalResponder } from './payProposalResponder';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A pessoa aceita ou recusa uma proposta de salário ou recibo verde (com uma nota, opcional).
 * Responde o membro; se foi o próprio membro a propor o seu salário, responde o dono da empresa.
 * Aceite, passa a contar; se substitui outro salário, esse fecha na véspera do início desta —
 * as duas coisas juntas, e só se ainda estiver por responder (dois cliques não respondem duas vezes).
 * Quem gere os salários recebe a resposta (`member_pay_answered`).
 */
export async function respondPayProposal(
  userId: string,
  payId: string,
  accept: boolean,
  note: string | undefined,
  repository: PrismaCompanyInvitationRepository,
  notifications: NotificationService,
) {
  const pay = await repository.findPay(payId);
  if (!pay || payProposalResponder(pay) !== userId) throw new NotFoundException('Proposta não encontrada');
  if (pay.status !== 'proposed') throw new BadRequestException('Esta proposta já foi respondida');

  const closeAt = accept && pay.replaces && pay.startDate ? new Date(pay.startDate.getTime() - DAY_MS) : null;
  const answered = await repository.answerPay(
    pay.id,
    { status: accept ? 'accepted' : 'declined', respondedAt: new Date(), responseNote: note?.trim() || null },
    closeAt && pay.replaces && (!pay.replaces.endDate || pay.replaces.endDate > closeAt)
      ? { id: pay.replaces.id, endDate: closeAt }
      : null,
  );
  if (!answered) throw new ConflictException('Esta proposta já foi respondida');

  await notifications.closeActions('member_pay_proposed', 'payId', pay.id, accept ? 'accepted' : 'declined');
  const company = pay.member.company;
  const managers = (await repository.findManagerUserIds(company.id, ['salaries.manage'])).filter((id) => id !== userId);
  await notifications.send(
    managers,
    'member_pay_answered',
    {
      payId: pay.id,
      memberId: pay.member.id,
      companyId: company.id,
      companyName: company.name,
      userName: pay.member.user?.fullName ?? null,
      kind: pay.kind,
      grossAmount: Number(pay.grossAmount),
      currency: pay.member.currency?.shortCode ?? pay.member.company.currency.shortCode,
      accepted: accept,
      note: note?.trim() || null,
    },
    `/Companies/${company.slug}/membros/pessoa/${pay.member.id}`,
  );
  return { id: pay.id, status: accept ? 'accepted' : 'declined' };
}
