import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CompanyMember,
  CompanyMemberContract,
  CompanyMemberDocument,
  CompanyMemberPay,
} from 'src/generated/prisma/client/client';
import {
  CompanyMemberRepository,
  MemberContractData,
  MemberDocumentData,
  MemberPayData,
  MemberPayWithCount,
  MemberPayWithMember,
} from '../company-member-repository';

@Injectable()
export class PrismaCompanyMemberRepository implements CompanyMemberRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMember(
    companyId: string,
    memberId: string,
  ): Promise<CompanyMember | null> {
    return this.prisma.companyMember.findFirst({
      where: { id: memberId, companyId },
    });
  }

  async findPays(memberId: string): Promise<MemberPayWithCount[]> {
    return this.prisma.companyMemberPay.findMany({
      where: { memberId },
      // Os salários pela data de início, os recibos pela data; os mais recentes primeiro
      orderBy: [{ kind: 'desc' }, { startDate: 'desc' }, { dueDate: 'desc' }],
      include: { _count: { select: { payments: true } } },
    });
  }

  async findPay(
    memberId: string,
    payId: string,
  ): Promise<MemberPayWithCount | null> {
    return this.prisma.companyMemberPay.findFirst({
      where: { id: payId, memberId },
      include: { _count: { select: { payments: true } } },
    });
  }

  async createPay(
    memberId: string,
    kind: string,
    data: MemberPayData,
  ): Promise<CompanyMemberPay> {
    return this.prisma.companyMemberPay.create({
      data: { memberId, kind, ...data, grossAmount: data.grossAmount ?? 0 },
    });
  }

  /** Cria e, se vier, fecha o salário que este substitui — tudo ou nada. */
  async createPayReplacing(
    memberId: string,
    kind: string,
    data: MemberPayData,
    closeReplaced: { id: string; endDate: Date } | null,
  ): Promise<CompanyMemberPay> {
    return this.prisma.$transaction(async (tx) => {
      const pay = await tx.companyMemberPay.create({
        data: { memberId, kind, ...data, grossAmount: data.grossAmount ?? 0 },
      });
      if (closeReplaced) {
        await tx.companyMemberPay.update({
          where: { id: closeReplaced.id },
          data: { endDate: closeReplaced.endDate },
        });
      }
      return pay;
    });
  }

  // Os ganhos pessoais que já apontam para este salário (o membro confirmou que recebeu)
  async countPayIncomes(payId: string): Promise<number> {
    return this.prisma.personalIncome.count({ where: { memberPayId: payId } });
  }

  /**
   * O último mês já pago de um salário (YYYY-MM): pelos pagamentos da empresa (os rascunhos contam, para não se
   * pagar outra vez) e pelos ganhos que o membro marcou como recebidos. Sem nenhum, nulo.
   */
  async findLastPaidPeriod(payId: string): Promise<string | null> {
    const [payments, incomes] = await Promise.all([
      this.prisma.companyPayment.findMany({
        where: { memberPayId: payId, status: { not: 'cancelled' }, memberPayPeriod: { not: null } },
        select: { memberPayPeriod: true },
      }),
      this.prisma.personalIncome.findMany({ where: { memberPayId: payId, period: { not: null } }, select: { period: true } }),
    ]);
    const months = [...payments.map((p) => p.memberPayPeriod), ...incomes.map((i) => i.period)]
      .filter((p): p is string => Boolean(p) && /^\d{4}-\d{2}/.test(p!))
      .map((p) => p.slice(0, 7));
    return months.length ? months.sort().at(-1)! : null;
  }

  /** A proposta por responder que muda este salário (feita ao editá-lo depois de aceite). */
  findPendingReplacement(payId: string): Promise<CompanyMemberPay | null> {
    return this.prisma.companyMemberPay.findFirst({ where: { replacesId: payId, status: 'proposed' } });
  }

  async updatePay(
    payId: string,
    data: MemberPayData,
  ): Promise<CompanyMemberPay> {
    return this.prisma.companyMemberPay.update({ where: { id: payId }, data });
  }

  async deletePay(payId: string): Promise<void> {
    await this.prisma.companyMemberPay.delete({ where: { id: payId } });
  }

  async findContracts(memberId: string): Promise<CompanyMemberContract[]> {
    return this.prisma.companyMemberContract.findMany({
      where: { memberId },
      orderBy: { startDate: 'desc' },
    });
  }

  async findContract(
    memberId: string,
    contractId: string,
  ): Promise<CompanyMemberContract | null> {
    return this.prisma.companyMemberContract.findFirst({
      where: { id: contractId, memberId },
    });
  }

  async createContract(
    memberId: string,
    data: MemberContractData,
  ): Promise<CompanyMemberContract> {
    return this.prisma.companyMemberContract.create({
      data: {
        memberId,
        type: data.type ?? 'other',
        startDate: data.startDate ?? new Date(),
        ...data,
      },
    });
  }

  async updateContract(
    contractId: string,
    data: MemberContractData,
  ): Promise<CompanyMemberContract> {
    return this.prisma.companyMemberContract.update({
      where: { id: contractId },
      data,
    });
  }

  // Os salários e os documentos dele ficam: a ligação cai sozinha (SET NULL)
  async deleteContract(contractId: string): Promise<void> {
    await this.prisma.companyMemberContract.delete({
      where: { id: contractId },
    });
  }

  async findDocuments(memberId: string): Promise<CompanyMemberDocument[]> {
    return this.prisma.companyMemberDocument.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findDocument(
    memberId: string,
    documentId: string,
  ): Promise<CompanyMemberDocument | null> {
    return this.prisma.companyMemberDocument.findFirst({
      where: { id: documentId, memberId },
    });
  }

  async createDocument(
    data: MemberDocumentData,
  ): Promise<CompanyMemberDocument> {
    return this.prisma.companyMemberDocument.create({ data });
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.prisma.companyMemberDocument.delete({
      where: { id: documentId },
    });
  }

  async findCurrency(currencyId: string) {
    return this.prisma.currency.findUnique({
      where: { id: currencyId },
      select: { id: true, shortCode: true, symbol: true, rate: true },
    });
  }

  async findCompanyPays(companyId: string): Promise<MemberPayWithMember[]> {
    return this.prisma.companyMemberPay.findMany({
      // As propostas por aceitar (e as recusadas) ainda não se pagam
      where: { status: 'accepted', member: { companyId } },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            bankAccountId: true,
            user: { select: { fullName: true } },
            currency: { select: { id: true, shortCode: true, symbol: true, rate: true } },
          },
        },
      },
    });
  }

  async findPaidPeriods(payIds: string[]): Promise<Set<string>> {
    if (payIds.length === 0) return new Set();
    const payments = await this.prisma.companyPayment.findMany({
      // Só os concluídos: um rascunho não tira o período dos próximos pagamentos
      where: { memberPayId: { in: payIds }, status: 'completed' },
      select: { memberPayId: true, memberPayPeriod: true },
    });
    return new Set(
      payments.map(
        (payment) => `${payment.memberPayId}|${payment.memberPayPeriod}`,
      ),
    );
  }
}
