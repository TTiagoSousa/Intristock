import { latestRateHour } from 'src/currency/helpers/latestRateHour';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  PersonalExpense,
  PersonalExpenseCategory,
  PersonalItemCategory,
  PersonalProduct,
} from 'src/generated/prisma/client/client';
import {
  ExpenseCurrency,
  ExpenseData,
  ExpenseFilters,
  ExpenseItemData,
  ExpenseWithRefs,
  PersonalExpenseRepository,
  ProductData,
  ProductPurchase,
  SubscriptionData,
  SubscriptionPayment,
  SubscriptionWithRefs,
} from '../personal-expense-repository';

const CURRENCY = {
  select: { id: true, shortCode: true, symbol: true, rate: true },
};
const CATEGORY = { select: { id: true, name: true, parentId: true } };
const SUBSCRIPTION_REFS = {
  currency: CURRENCY,
  category: CATEGORY,
  bankAccount: { select: { id: true, name: true } },
};
const PAYMENT = {
  select: {
    id: true,
    subscriptionId: true,
    period: true,
    date: true,
    amount: true,
    status: true,
  },
};

@Injectable()
export class PrismaPersonalExpenseRepository implements PersonalExpenseRepository {
  constructor(private readonly prisma: PrismaService) {}

  countCategories(userId: string) {
    return this.prisma.personalExpenseCategory.count({ where: { userId } });
  }

  findCategories(userId: string): Promise<PersonalExpenseCategory[]> {
    return this.prisma.personalExpenseCategory.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  findCategory(userId: string, categoryId: string) {
    return this.prisma.personalExpenseCategory.findFirst({
      where: { id: categoryId, userId },
    });
  }

  createCategory(userId: string, name: string, parentId: string | null) {
    return this.prisma.personalExpenseCategory.create({
      data: { userId, name, parentId },
    });
  }

  updateCategory(
    categoryId: string,
    data: { name?: string; isActive?: boolean; parentId?: string | null },
  ) {
    return this.prisma.personalExpenseCategory.update({
      where: { id: categoryId },
      data,
    });
  }

  countItemCategories(userId: string) {
    return this.prisma.personalItemCategory.count({ where: { userId } });
  }

  findItemCategories(userId: string): Promise<PersonalItemCategory[]> {
    return this.prisma.personalItemCategory.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  findItemCategory(userId: string, categoryId: string) {
    return this.prisma.personalItemCategory.findFirst({
      where: { id: categoryId, userId },
    });
  }

  createItemCategory(userId: string, name: string, parentId: string | null) {
    return this.prisma.personalItemCategory.create({
      data: { userId, name, parentId },
    });
  }

  updateItemCategory(
    categoryId: string,
    data: { name?: string; isActive?: boolean; parentId?: string | null },
  ) {
    return this.prisma.personalItemCategory.update({
      where: { id: categoryId },
      data,
    });
  }

  findProductPurchases(userId: string): Promise<ProductPurchase[]> {
    return this.prisma.personalExpenseItem.findMany({
      where: { expense: { userId }, productId: { not: null } },
      select: {
        productId: true,
        quantity: true,
        unitPrice: true,
        amount: true,
        expense: {
          select: { date: true, status: true, currency: CURRENCY, rateHour: true },
        },
      },
    });
  }

  findProducts(userId: string): Promise<PersonalProduct[]> {
    return this.prisma.personalProduct.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  findProduct(userId: string, productId: string) {
    return this.prisma.personalProduct.findFirst({
      where: { id: productId, userId },
    });
  }

  findProductByName(userId: string, name: string) {
    return this.prisma.personalProduct.findFirst({
      where: { userId, name: { equals: name, mode: 'insensitive' } },
    });
  }

  createProduct(userId: string, data: ProductData) {
    return this.prisma.personalProduct.create({
      data: { userId, name: data.name ?? '', ...data },
    });
  }

  updateProduct(productId: string, data: ProductData) {
    return this.prisma.personalProduct.update({
      where: { id: productId },
      data,
    });
  }

  findExpenses(
    userId: string,
    filters: ExpenseFilters,
  ): Promise<ExpenseWithRefs[]> {
    const q = filters.q?.trim();
    return this.prisma.personalExpense.findMany({
      where: {
        userId,
        ...(filters.from || filters.to
          ? { date: { gte: filters.from, lte: filters.to } }
          : {}),
        ...(filters.kind ? { kind: filters.kind } : {}),
        ...(filters.categoryIds
          ? {
              categoryId: { in: filters.categoryIds },
            }
          : {}),
        ...(q
          ? {
              AND: [
                {
                  OR: [
                    { merchant: { contains: q, mode: 'insensitive' } },
                    { description: { contains: q, mode: 'insensitive' } },
                    {
                      items: {
                        some: { name: { contains: q, mode: 'insensitive' } },
                      },
                    },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        category: CATEGORY,
        company: { select: { id: true, name: true, slug: true } },
        currency: CURRENCY,
        bankAccount: { select: { id: true, name: true } },
        items: { orderBy: { position: 'asc' } },
      },
    });
  }

  findExpense(
    userId: string,
    expenseId: string,
  ): Promise<PersonalExpense | null> {
    return this.prisma.personalExpense.findFirst({
      where: { id: expenseId, userId },
    });
  }

  async createExpense(userId: string, data: ExpenseData, items: ExpenseItemData[]) {
    return this.prisma.personalExpense.create({
      data: {
        userId,
        kind: data.kind ?? 'purchase',
        date: data.date ?? new Date(),
        amount: data.amount ?? 0,
        currencyId: data.currencyId ?? '',
        ...data,
        // A hora das cotações com que se converte (a mais recente guardada)
        rateHour: await latestRateHour(this.prisma),
        items: { create: items },
      },
    });
  }

  async updateExpense(
    expenseId: string,
    data: ExpenseData,
    items: ExpenseItemData[] | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (items) {
        await tx.personalExpenseItem.deleteMany({ where: { expenseId } });
        await tx.personalExpenseItem.createMany({
          data: items.map((item) => ({ ...item, expenseId })),
        });
      }
      return tx.personalExpense.update({ where: { id: expenseId }, data });
    });
  }

  async deleteExpense(expenseId: string): Promise<void> {
    await this.prisma.personalExpense.delete({ where: { id: expenseId } });
  }

  findSubscriptions(userId: string): Promise<SubscriptionWithRefs[]> {
    return this.prisma.personalSubscription.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: SUBSCRIPTION_REFS,
    });
  }

  findSubscription(
    userId: string,
    subscriptionId: string,
  ): Promise<SubscriptionWithRefs | null> {
    return this.prisma.personalSubscription.findFirst({
      where: { id: subscriptionId, userId },
      include: SUBSCRIPTION_REFS,
    });
  }

  createSubscription(userId: string, data: SubscriptionData) {
    return this.prisma.personalSubscription.create({
      data: {
        userId,
        kind: data.kind ?? 'other',
        name: data.name ?? '',
        amount: data.amount ?? 0,
        currencyId: data.currencyId ?? '',
        startDate: data.startDate ?? new Date(),
        ...data,
      },
    });
  }

  updateSubscription(subscriptionId: string, data: SubscriptionData) {
    return this.prisma.personalSubscription.update({
      where: { id: subscriptionId },
      data,
    });
  }

  async deleteSubscription(subscriptionId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.personalExpense.updateMany({
        where: { subscriptionId },
        data: { subscriptionId: null, period: null },
      }),
      this.prisma.personalSubscription.delete({
        where: { id: subscriptionId },
      }),
    ]);
  }

  findSubscriptionPayments(userId: string): Promise<SubscriptionPayment[]> {
    return this.prisma.personalExpense.findMany({
      where: { userId, subscriptionId: { not: null } },
      ...PAYMENT,
    });
  }

  findSubscriptionPayment(
    subscriptionId: string,
    period: string,
  ): Promise<SubscriptionPayment | null> {
    return this.prisma.personalExpense.findFirst({
      where: { subscriptionId, period },
      ...PAYMENT,
    });
  }

  findCurrency(currencyId: string): Promise<ExpenseCurrency | null> {
    return this.prisma.currency.findUnique({
      where: { id: currencyId },
      ...CURRENCY,
    });
  }

  findCurrencyByCode(shortCode: string): Promise<ExpenseCurrency | null> {
    return this.prisma.currency.findUnique({
      where: { shortCode },
      ...CURRENCY,
    });
  }

  findUserBankAccount(userId: string, bankAccountId: string) {
    return this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, userId },
      select: { id: true },
    });
  }
}
