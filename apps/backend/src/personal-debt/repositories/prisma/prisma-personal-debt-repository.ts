import { latestRateHour } from 'src/currency/helpers/latestRateHour';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  PersonalDebt,
  PersonalDebtMovement,
} from 'src/generated/prisma/client/client';
import {
  DebtCurrency,
  DebtData,
  DebtMovementData,
  DebtMovementFilters,
  DebtMovementWithRefs,
  DebtWithRefs,
  PersonalDebtRepository,
} from '../personal-debt-repository';

const CURRENCY = {
  select: { id: true, shortCode: true, symbol: true, rate: true },
};
const NAMED = { select: { id: true, name: true } };

const DEBT_INCLUDE = {
  currency: CURRENCY,
  platform: { select: { id: true, name: true, logo: true } },
  bankAccount: NAMED,
  movements: { orderBy: { date: 'asc' as const } },
};

@Injectable()
export class PrismaPersonalDebtRepository implements PersonalDebtRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDebts(userId: string): Promise<DebtWithRefs[]> {
    return this.prisma.personalDebt.findMany({
      where: { userId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: DEBT_INCLUDE,
    });
  }

  async findDebt(userId: string, debtId: string): Promise<DebtWithRefs | null> {
    return this.prisma.personalDebt.findFirst({
      where: { id: debtId, userId },
      include: DEBT_INCLUDE,
    });
  }

  async createDebt(userId: string, data: DebtData): Promise<PersonalDebt> {
    return this.prisma.personalDebt.create({
      data: {
        userId,
        kind: data.kind ?? 'other',
        name: data.name ?? '',
        currencyId: data.currencyId ?? '',
        principal: data.principal ?? 0,
        openingBalance: data.openingBalance ?? 0,
        openingDate: data.openingDate ?? new Date(),
        startDate: data.startDate ?? new Date(),
        ...data,
      },
    });
  }

  async updateDebt(debtId: string, data: DebtData): Promise<PersonalDebt> {
    return this.prisma.personalDebt.update({ where: { id: debtId }, data });
  }

  async deleteDebt(debtId: string): Promise<void> {
    await this.prisma.personalDebt.delete({ where: { id: debtId } });
  }

  async findMovements(
    userId: string,
    filters: DebtMovementFilters,
  ): Promise<DebtMovementWithRefs[]> {
    return this.prisma.personalDebtMovement.findMany({
      where: {
        debt: { userId },
        debtId: filters.debtId,
        kind: filters.kind,
        date: { gte: filters.from, lte: filters.to },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        debt: {
          select: {
            id: true,
            name: true,
            kind: true,
            direction: true,
            currency: CURRENCY,
          },
        },
        bankAccount: NAMED,
      },
    });
  }

  async findMovement(
    userId: string,
    movementId: string,
  ): Promise<PersonalDebtMovement | null> {
    return this.prisma.personalDebtMovement.findFirst({
      where: { id: movementId, debt: { userId } },
    });
  }

  async createMovement(data: DebtMovementData): Promise<PersonalDebtMovement> {
    return this.prisma.personalDebtMovement.create({
      data: {
        debtId: data.debtId ?? '',
        kind: data.kind ?? 'installment',
        date: data.date ?? new Date(),
        amount: data.amount ?? 0,
        ...data,
        // A hora das cotações com que se converte (a mais recente guardada)
        rateHour: await latestRateHour(this.prisma),

      },
    });
  }

  async updateMovement(
    movementId: string,
    data: DebtMovementData,
  ): Promise<PersonalDebtMovement> {
    return this.prisma.personalDebtMovement.update({
      where: { id: movementId },
      data,
    });
  }

  async deleteMovement(movementId: string): Promise<void> {
    await this.prisma.personalDebtMovement.delete({
      where: { id: movementId },
    });
  }

  async findCurrency(currencyId: string): Promise<DebtCurrency | null> {
    return this.prisma.currency.findUnique({
      where: { id: currencyId },
      ...CURRENCY,
    });
  }

  async findCurrencyByCode(shortCode: string): Promise<DebtCurrency | null> {
    return this.prisma.currency.findUnique({
      where: { shortCode },
      ...CURRENCY,
    });
  }

  async findUserBankAccount(userId: string, bankAccountId: string) {
    return this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, userId },
      select: { id: true },
    });
  }

  async findBank(platformId: string) {
    return this.prisma.platform.findFirst({
      where: { id: platformId, type: 'bank' },
      select: { id: true },
    });
  }
}
