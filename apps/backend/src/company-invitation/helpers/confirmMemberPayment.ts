import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { NotificationService } from 'src/notification/notification.service';
import { PrismaCompanyInvitationRepository } from '../repositories/prisma/prisma-company-invitation-repository';
import { incomeFromMemberPayment } from './incomeFromMemberPayment';
import { payoutIncomeDescription } from 'src/time-tracking/helpers/payoutIncomeDescription';
import { PrismaTimeTrackingRepository } from 'src/time-tracking/repositories/prisma/prisma-time-tracking-repository';

/**
 * A pessoa confirma que recebeu (cria-se o ganho pessoal, já preenchido, se ainda não existir)
 * ou diz que não recebeu um pagamento da empresa: um salário ou recibo (`company_payment`) ou
 * horas do banco de horas (`time_tracking`). Quem gere recebe `member_payment_confirmed`.
 *
 * Só se responde uma vez: o aviso `member_paid` passa de `pending` à resposta logo no início, e
 * essa passagem é atómica — o segundo de dois pedidos ao mesmo tempo (o sino e a página, ou um
 * clique duplo) já não o encontra pendente e é recusado. Se o ganho falhar, o aviso volta a pendente.
 */
export async function confirmMemberPayment(
  userId: string,
  source: 'company_payment' | 'time_tracking',
  id: string,
  received: boolean,
  repository: PrismaCompanyInvitationRepository,
  notifications: NotificationService,
  timeTracking: PrismaTimeTrackingRepository,
) {
  let company: { id: string; name: string; slug: string };
  let amount: number;
  let currency: string;
  let link: string;
  let incomeId: string | null = null;

  const key = source === 'company_payment' ? 'paymentId' : 'payoutId';
  const answer = received ? 'done' : 'declined';
  // Tranca a resposta: quem fecha o aviso é quem responde
  const claim = async () => {
    if ((await notifications.closeActions('member_paid', key, id, answer)) === 0) {
      throw new ConflictException('Este pagamento já foi respondido');
    }
  };
  const release = () => notifications.reopenActions('member_paid', key, id, answer).catch(() => undefined);

  if (source === 'company_payment') {
    const payment = await repository.findMemberPayment(id);
    if (!payment || payment.member?.userId !== userId) throw new NotFoundException('Pagamento não encontrado');
    if (payment.status !== 'completed') throw new BadRequestException('Este pagamento não está concluído');
    company = payment.company;
    amount = Number(payment.amount);
    currency = payment.currency.shortCode;
    link = `/Companies/${company.slug}/compras/pagamentos`;

    const exists = await repository.findIncomeOfPayment(payment);
    if (exists) {
      // Já está nos ganhos (marcado como recebido nos Ganhos): «Recebi» só fecha o aviso; «Não recebi» não faz sentido
      if (!received) throw new ConflictException('Este pagamento já está nos teus ganhos: apaga-o lá primeiro');
      await notifications.closeActions('member_paid', key, id, 'done');
      return { id, received, incomeId: exists.id };
    }
    await claim();
    if (received) {
      try {
        // O `companyPaymentId` é único: mesmo que tudo o resto falhasse, não nascem dois
        incomeId = (await repository.createIncome(incomeFromMemberPayment(userId, payment))).id;
      } catch (error) {
        await release();
        throw error;
      }
    }
  } else {
    // As horas que a empresa pagou a esta pessoa (não o que o cliente pagou à empresa)
    const payout = await repository.findPayout(id);
    if (!payout || payout.userId !== userId) throw new NotFoundException('Pagamento não encontrado');
    company = payout.company;
    amount = Number(payout.netAmount);
    currency = payout.currency.shortCode;
    link = `/Companies/${company.slug}/horas/registo`;
    // A resposta fica no próprio payout, uma vez só: é este o trinco (o aviso fecha-se a seguir,
    // se ainda estiver aberto)
    if ((await timeTracking.markPayoutAnswered(payout.id, received ? 'received' : 'declined')) === 0) {
      throw new ConflictException('Este pagamento já foi respondido');
    }
    await notifications.closeActions('member_paid', key, id, answer);
    if (received) {
      incomeId = payout.personalIncome?.id ?? null;
      if (!incomeId) {
        try {
          // Quem paga é a empresa: a fonte é ela, sem os clientes dela
          const income = await repository.createCompanyIncome({
            userId,
            kind: 'freelance',
            description: payoutIncomeDescription(payout.seconds),
            grossAmount: payout.grossAmount,
            withholdingPct: payout.withholdingPct,
            amount: payout.netAmount,
            currencyId: payout.currencyId,
            date: payout.paidAt,
            status: 'received',
          }, company);
          await repository.linkPayoutIncome(payout.id, income.id);
          incomeId = income.id;
        } catch (error) {
          // O ganho não entrou: o payout e o aviso voltam a estar por responder
          await repository.reopenPayoutAnswer(payout.id).catch(() => undefined);
          await release();
          throw error;
        }
      }
    }
  }

  const managers = (
    await repository.findManagerUserIds(company.id, source === 'company_payment' ? ['salaries.manage', 'payments.view'] : ['timesheet.manage'])
  ).filter((managerId) => managerId !== userId);
  const user = await repository.findUserName(userId);
  await notifications.send(
    managers,
    'member_payment_confirmed',
    { source, [key]: id, companyId: company.id, companyName: company.name, userName: user?.fullName ?? null, amount, currency, received },
    link,
  );
  return { id, received, incomeId };
}
