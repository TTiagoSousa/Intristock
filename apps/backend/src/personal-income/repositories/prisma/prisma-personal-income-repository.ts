import { rateHourForDate } from 'src/currency/helpers/rateHourForDate';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  PersonalIncome,
  PersonalIncomeSource,
} from 'src/generated/prisma/client/client';
import {
  IncomeCurrency,
  IncomeData,
  IncomeFilters,
  IncomeSourceData,
  IncomeSourceWithRefs,
  IncomeWithRefs,
  PersonalIncomeRepository,
  UserMemberPay,
} from '../personal-income-repository';

const CURRENCY = {
  select: { id: true, shortCode: true, symbol: true, rate: true },
};
const COMPANY = { select: { id: true, name: true, slug: true } };

// As empresas que a pessoa vê: as que criou e aquelas em que é membro (não apagadas)
const accessibleBy = (userId: string) => ({
  status: { not: 'deleted' },
  OR: [{ createdById: userId }, { members: { some: { userId, status: 'active' } } }],
});

@Injectable()
export class PrismaPersonalIncomeRepository implements PersonalIncomeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSources(userId: string): Promise<IncomeSourceWithRefs[]> {
    return this.prisma.personalIncomeSource.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: {
        company: COMPANY,
        currency: CURRENCY,
        _count: { select: { incomes: true } },
      },
    });
  }

  async findSource(
    userId: string,
    sourceId: string,
  ): Promise<IncomeSourceWithRefs | null> {
    return this.prisma.personalIncomeSource.findFirst({
      where: { id: sourceId, userId },
      include: {
        company: COMPANY,
        currency: CURRENCY,
        _count: { select: { incomes: true } },
      },
    });
  }

  async createSource(
    userId: string,
    data: IncomeSourceData,
  ): Promise<PersonalIncomeSource> {
    return this.prisma.personalIncomeSource.create({
      data: {
        userId,
        kind: data.kind ?? 'other',
        name: data.name ?? '',
        ...data,
      },
    });
  }

  async updateSource(
    sourceId: string,
    data: IncomeSourceData,
  ): Promise<PersonalIncomeSource> {
    return this.prisma.personalIncomeSource.update({
      where: { id: sourceId },
      data,
    });
  }

  async deleteSource(sourceId: string): Promise<void> {
    await this.prisma.personalIncomeSource.delete({ where: { id: sourceId } });
  }

  async findIncomes(
    userId: string,
    filters: IncomeFilters,
  ): Promise<IncomeWithRefs[]> {
    return this.prisma.personalIncome.findMany({
      where: {
        userId,
        ...(filters.from || filters.to
          ? { date: { gte: filters.from, lte: filters.to } }
          : {}),
        ...(filters.kind ? { kind: filters.kind } : {}),
        ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        source: { select: { id: true, name: true, kind: true } },
        currency: CURRENCY,
        bankAccount: { select: { id: true, name: true } },
        memberPay: {
          select: {
            id: true,
            kind: true,
            member: { select: { company: COMPANY } },
          },
        },
      },
    });
  }

  async findIncome(
    userId: string,
    incomeId: string,
  ): Promise<PersonalIncome | null> {
    return this.prisma.personalIncome.findFirst({
      where: { id: incomeId, userId },
    });
  }

  async createIncome(
    userId: string,
    data: IncomeData,
  ): Promise<PersonalIncome> {
    return this.prisma.personalIncome.create({
      data: {
        userId,
        kind: data.kind ?? 'other',
        amount: data.amount ?? 0,
        currencyId: data.currencyId ?? '',
        date: data.date ?? new Date(),
        ...data,
        // A hora das cotações com que se converte: a mais recente, só num ganho de hoje
        rateHour: await rateHourForDate(this.prisma, data.date ?? new Date()),
      },
    });
  }

  async updateIncome(
    incomeId: string,
    data: IncomeData,
  ): Promise<PersonalIncome> {
    return this.prisma.personalIncome.update({
      where: { id: incomeId },
      // Com outra data, a hora das cotações volta a decidir-se por ela
      data:
        data.date !== undefined
          ? { ...data, rateHour: await rateHourForDate(this.prisma, data.date) }
          : data,
    });
  }

  async deleteIncome(incomeId: string): Promise<void> {
    await this.prisma.personalIncome.delete({ where: { id: incomeId } });
  }

  async findRecordedPeriods(userId: string): Promise<Set<string>> {
    const incomes = await this.prisma.personalIncome.findMany({
      where: { userId, period: { not: null } },
      select: { sourceId: true, memberPayId: true, period: true },
    });
    const keys = new Set<string>();
    for (const income of incomes) {
      if (income.sourceId) keys.add(`${income.sourceId}|${income.period}`);
      if (income.memberPayId)
        keys.add(`${income.memberPayId}|${income.period}`);
    }
    return keys;
  }

  private memberPayInclude() {
    return {
      member: {
        select: {
          id: true,
          name: true,
          bankAccountId: true,
          user: { select: { fullName: true } },
          currency: CURRENCY,
          company: {
            select: { id: true, name: true, slug: true, currency: CURRENCY },
          },
        },
      },
    };
  }

  async findUserMemberPays(userId: string): Promise<UserMemberPay[]> {
    return this.prisma.companyMemberPay.findMany({
      where: {
        // Só os aceites, de empresas onde a pessoa já entrou
        status: 'accepted',
        member: { userId, status: 'active', company: { status: { not: 'deleted' } } },
      },
      include: this.memberPayInclude(),
    });
  }

  async findUserMemberPay(
    userId: string,
    payId: string,
  ): Promise<UserMemberPay | null> {
    return this.prisma.companyMemberPay.findFirst({
      where: { id: payId, status: 'accepted', member: { userId, status: 'active' } },
      include: this.memberPayInclude(),
    });
  }

  async findCompanyPaidPeriods(
    payIds: string[],
  ): Promise<Map<string, { amount: number; currencyId: string }>> {
    if (payIds.length === 0) return new Map();
    const payments = await this.prisma.companyPayment.findMany({
      // Só os concluídos: um rascunho ainda não é um pagamento feito
      where: { memberPayId: { in: payIds }, status: 'completed' },
      select: { memberPayId: true, memberPayPeriod: true, amount: true, currencyId: true },
    });
    return new Map(
      payments.map((payment) => [
        `${payment.memberPayId}|${payment.memberPayPeriod}`,
        { amount: Number(payment.amount), currencyId: payment.currencyId },
      ]),
    );
  }

  async findLastMemberPayIncomes(
    userId: string,
    payIds: string[],
  ): Promise<Map<string, { amount: number; currencyId: string }>> {
    if (payIds.length === 0) return new Map();
    const incomes = await this.prisma.personalIncome.findMany({
      where: { userId, memberPayId: { in: payIds } },
      orderBy: { date: 'desc' },
      select: { memberPayId: true, amount: true, currencyId: true },
    });
    const last = new Map<string, { amount: number; currencyId: string }>();
    for (const income of incomes) {
      if (income.memberPayId && !last.has(income.memberPayId))
        last.set(income.memberPayId, { amount: Number(income.amount), currencyId: income.currencyId });
    }
    return last;
  }

  async findCurrency(currencyId: string): Promise<IncomeCurrency | null> {
    return this.prisma.currency.findUnique({
      where: { id: currencyId },
      select: { id: true, shortCode: true, symbol: true, rate: true },
    });
  }

  async findCurrencyByCode(shortCode: string): Promise<IncomeCurrency | null> {
    return this.prisma.currency.findUnique({
      where: { shortCode },
      select: { id: true, shortCode: true, symbol: true, rate: true },
    });
  }

  async findUserBankAccount(userId: string, bankAccountId: string) {
    return this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, userId },
      select: { id: true },
    });
  }

  async findAccessibleCompany(userId: string, companyId: string) {
    return this.prisma.company.findFirst({
      where: { id: companyId, ...accessibleBy(userId) },
      select: { id: true },
    });
  }

  async findAccessibleCompanies(userId: string) {
    return this.prisma.company.findMany({
      where: accessibleBy(userId),
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    });
  }
}
