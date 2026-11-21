import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'src/generated/prisma/client/client';
import { rateHourForDate } from 'src/currency/helpers/rateHourForDate';
import { ensureCompanyIncomeSource } from 'src/personal-income/helpers/ensureCompanyIncomeSource';
import { CompanyPermission, resolveMemberPermissions } from 'src/company/permissions/companyPermissions';

const COMPANY = {
  select: { id: true, name: true, slug: true, createdById: true, currency: { select: { shortCode: true } } },
} as const;
const CURRENCY = { select: { id: true, shortCode: true, symbol: true } } as const;

/** Os convites, as propostas de salário e os pagamentos a confirmar, do lado de quem os recebe. */
@Injectable()
export class PrismaCompanyInvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Quem gere uma coisa na empresa: o dono e os membros ativos com uma destas permissões. */
  async findManagerUserIds(companyId: string, permissions: CompanyPermission[]) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        createdById: true,
        members: {
          where: { status: 'active', userId: { not: null } },
          select: {
            userId: true,
            extraPermissions: true,
            deniedPermissions: true,
            role: { select: { permissions: true } },
          },
        },
      },
    });
    if (!company) return [];
    const ids = company.members
      .filter((member) => resolveMemberPermissions(member).some((p) => permissions.includes(p)))
      .map((member) => member.userId!);
    return [...new Set([company.createdById, ...ids])];
  }

  findUserName(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, fullName: true } });
  }

  // --- convites ---

  findMember(memberId: string) {
    return this.prisma.companyMember.findUnique({
      where: { id: memberId },
      include: { company: COMPANY, role: { select: { name: true } }, user: { select: { id: true, fullName: true } } },
    });
  }

  updateMember(memberId: string, data: Prisma.CompanyMemberUncheckedUpdateInput) {
    return this.prisma.companyMember.update({ where: { id: memberId }, data });
  }

  findInvites(userId: string) {
    return this.prisma.companyMember.findMany({
      where: { userId, status: 'invited', company: { status: { not: 'deleted' } } },
      include: {
        company: COMPANY,
        role: { select: { name: true } },
        invitedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { invitedAt: 'desc' },
    });
  }

  // --- propostas ---

  findPay(payId: string) {
    return this.prisma.companyMemberPay.findUnique({
      where: { id: payId },
      include: {
        member: { include: { company: COMPANY, currency: CURRENCY, user: { select: { id: true, fullName: true } } } },
        replaces: { select: { id: true, grossAmount: true, startDate: true, endDate: true } },
      },
    });
  }

  updatePay(payId: string, data: Prisma.CompanyMemberPayUncheckedUpdateInput) {
    return this.prisma.companyMemberPay.update({ where: { id: payId }, data });
  }

  // As propostas a que esta pessoa responde: as dela e, nas empresas de que é dona, as que um
  // membro fez ao próprio salário (ver `payProposalResponder`)
  async findProposals(userId: string) {
    const proposals = await this.prisma.companyMemberPay.findMany({
      where: {
        status: 'proposed',
        OR: [
          { member: { userId, company: { status: { not: 'deleted' } } } },
          { member: { company: { createdById: userId, status: { not: 'deleted' } } }, proposedById: { not: null } },
        ],
      },
      include: {
        member: { include: { company: COMPANY, currency: CURRENCY } },
        proposedBy: { select: { id: true, fullName: true } },
        replaces: { select: { id: true, grossAmount: true, startDate: true, endDate: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return proposals.filter((pay) => {
      const selfProposed = pay.proposedById !== null && pay.proposedById === pay.member.userId;
      return selfProposed ? pay.member.company.createdById === userId : pay.member.userId === userId;
    });
  }

  // --- pagamentos a membros (salários, recibos verdes) ---

  findMemberPayment(paymentId: string) {
    return this.prisma.companyPayment.findUnique({
      where: { id: paymentId },
      include: {
        company: COMPANY,
        currency: CURRENCY,
        member: { select: { id: true, userId: true, name: true } },
        memberPay: { select: { id: true, kind: true, grossAmount: true, withholdingPct: true, description: true } },
      },
    });
  }

  findIncomeOfPeriod(memberPayId: string, period: string) {
    return this.prisma.personalIncome.findFirst({ where: { memberPayId, period } });
  }

  /**
   * O ganho que já corresponde a este pagamento: o ligado a ele (`companyPaymentId`) ou, nos
   * de antes da ligação, o do mesmo salário e período.
   */
  findIncomeOfPayment(payment: { id: string; memberPayId: string | null; memberPayPeriod: string | null }) {
    return this.prisma.personalIncome.findFirst({
      where: {
        OR: [
          { companyPaymentId: payment.id },
          ...(payment.memberPayId && payment.memberPayPeriod
            ? [{ memberPayId: payment.memberPayId, period: payment.memberPayPeriod }]
            : []),
        ],
      },
    });
  }

  /**
   * Responde a uma proposta: só se ainda estiver `proposed` (dois cliques não respondem duas
   * vezes) e, aceite, fecha o salário que ela substitui — tudo junto. `false` se já tinha resposta.
   */
  answerPay(
    payId: string,
    data: Prisma.CompanyMemberPayUncheckedUpdateInput,
    closeReplaced: { id: string; endDate: Date } | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.companyMemberPay.updateMany({ where: { id: payId, status: 'proposed' }, data });
      if (count === 0) return false;
      if (closeReplaced) {
        await tx.companyMemberPay.update({ where: { id: closeReplaced.id }, data: { endDate: closeReplaced.endDate } });
      }
      return true;
    });
  }

  /** Os pagamentos da empresa a esta pessoa (como membro) desde uma data, com o ganho que lhe corresponde. */
  async findPaymentsToUser(userId: string, since: Date) {
    const payments = await this.prisma.companyPayment.findMany({
      where: {
        partyType: 'member',
        status: 'completed',
        paymentDate: { gte: since },
        member: { userId, status: 'active' },
        company: { status: { not: 'deleted' } },
      },
      include: {
        company: COMPANY,
        currency: CURRENCY,
        memberPay: { select: { id: true, kind: true, description: true } },
      },
      orderBy: { paymentDate: 'desc' },
    });
    const keyed = payments.filter((payment) => payment.memberPayId && payment.memberPayPeriod);
    const incomes = payments.length
      ? await this.prisma.personalIncome.findMany({
          where: {
            userId,
            OR: [
              { companyPaymentId: { in: payments.map((payment) => payment.id) } },
              ...keyed.map((payment) => ({ memberPayId: payment.memberPayId, period: payment.memberPayPeriod })),
            ],
          },
          select: { id: true, memberPayId: true, period: true, amount: true, companyPaymentId: true },
        })
      : [];
    return payments.map((payment) => ({
      payment,
      income:
        incomes.find((income) => income.companyPaymentId === payment.id) ??
        incomes.find(
          (income) =>
            payment.memberPayId !== null &&
            income.memberPayId === payment.memberPayId &&
            income.period === payment.memberPayPeriod,
        ) ??
        null,
    }));
  }

  // --- horas pagas pela empresa a quem as fez (banco de horas) ---

  findPayout(payoutId: string) {
    return this.prisma.timeTrackingPayout.findUnique({
      where: { id: payoutId },
      include: { company: COMPANY, currency: CURRENCY, personalIncome: { select: { id: true, amount: true } } },
    });
  }

  findPayoutsToUser(userId: string, since: Date) {
    return this.prisma.timeTrackingPayout.findMany({
      where: { userId, paidAt: { gte: since }, company: { status: { not: 'deleted' } } },
      include: { company: COMPANY, currency: CURRENCY, personalIncome: { select: { id: true, amount: true } } },
      orderBy: { paidAt: 'desc' },
    });
  }

  linkPayoutIncome(payoutId: string, personalIncomeId: string) {
    return this.prisma.timeTrackingPayout.update({
      where: { id: payoutId },
      data: { personalIncomeId, confirmation: 'received', respondedAt: new Date() },
    });
  }

  /** Desfaz a resposta a um payout quando o ganho que a seguia falhou. */
  reopenPayoutAnswer(payoutId: string) {
    return this.prisma.timeTrackingPayout.updateMany({
      where: { id: payoutId, personalIncomeId: null },
      data: { confirmation: null, respondedAt: null },
    });
  }

  async createIncome(data: Prisma.PersonalIncomeUncheckedCreateInput) {
    // A hora das cotações só num ganho de hoje; um do passado converte pela cotação do dia dele
    return this.prisma.personalIncome.create({ data: { ...data, rateHour: await rateHourForDate(this.prisma, data.date) } });
  }

  /** Um ganho que vem de uma empresa sem salário da base (as horas): a fonte é a empresa. */
  async createCompanyIncome(data: Prisma.PersonalIncomeUncheckedCreateInput, company: { id: string; name: string }) {
    const sourceId = await ensureCompanyIncomeSource(this.prisma, data.userId, company);
    return this.createIncome({ ...data, sourceId });
  }
}
