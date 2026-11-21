import { isoDay as day } from 'src/utils/dates';
import { pickDisplayCurrency } from 'src/currency/helpers/pickDisplayCurrency';
import { CurrencyService } from 'src/currency/currency.service';
import { BadRequestException } from '@nestjs/common';
import { PrismaPersonalExpenseRepository } from '../repositories/prisma/prisma-personal-expense-repository';
import { ExpenseCurrency } from '../repositories/personal-expense-repository';
import {
  ExpenseSummaryQueryDto,
  MAX_EXPENSE_RANGE_MONTHS,
} from '../dto/personal-expense.dto';
import { findExpenses } from './findExpenses';

const DEFAULT_MONTHS = 12;
// Quantas lojas e produtos vão nas listas do dashboard
const TOP = 8;

// Uma categoria de item com o total dela e as de dentro
export type CategoryTotal = {
  id: string | null;
  name: string | null;
  total: number;
  children: CategoryTotal[];
};

const round = (value: number) => Math.round(value * 100) / 100;
const monthOf = (date: Date) => date.toISOString().slice(0, 7);

/**
 * O dashboard das despesas, numa moeda (a pedida, senão a mais usada, senão o
 * euro; as outras pela cotação do dia de cada despesa): o total de cada mês dos últimos
 * `months` (as pendentes à parte), os cartões, por categoria da despesa (com as
 * subcategorias), por categoria de item (a árvore toda, pelas linhas), por
 * tipo, as lojas e os produtos. Com `from`–`to` (meses), o gráfico e as somas são
 * desse intervalo; os cartões não mudam.
 */
export async function summarizeExpenses(
  userId: string,
  query: ExpenseSummaryQueryDto,
  repository: PrismaPersonalExpenseRepository,
  currencyService: CurrencyService,
) {
  const months = query.months ?? DEFAULT_MONTHS;
  const now = new Date();
  const currentMonth = monthOf(now);
  const previousMonth = monthOf(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
  );
  const firstMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1),
  );
  const lastDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  );

  // O gráfico e as somas: o intervalo escolhido à mão, ou o dos cartões
  let rangeStart = firstMonth;
  let rangeEnd = lastDay;
  if (query.from || query.to) {
    if (!query.from || !query.to)
      throw new BadRequestException('O intervalo precisa do início e do fim');
    const [fromYear, fromMonth] = query.from.split('-').map(Number);
    const [toYear, toMonth] = query.to.split('-').map(Number);
    rangeStart = new Date(Date.UTC(fromYear, fromMonth - 1, 1));
    rangeEnd = new Date(Date.UTC(toYear, toMonth, 0));
    if (rangeEnd < rangeStart)
      throw new BadRequestException(
        'O fim do intervalo não pode ser antes do início',
      );
    if (
      (toYear - fromYear) * 12 + toMonth - fromMonth + 1 >
      MAX_EXPENSE_RANGE_MONTHS
    )
      throw new BadRequestException(
        `O intervalo não pode ter mais de ${MAX_EXPENSE_RANGE_MONTHS} meses`,
      );
  }
  const inRange = (date: string) =>
    date >= day(rangeStart) && date <= day(rangeEnd);
  const inCards = (date: string) =>
    date >= day(firstMonth) && date <= day(lastDay);

  // Vai-se buscar o que cobre os dois
  const spanStart = rangeStart < firstMonth ? rangeStart : firstMonth;
  const spanEnd = rangeEnd > lastDay ? rangeEnd : lastDay;
  const [expenses, categories, itemCategories, products] = await Promise.all([
    findExpenses(
      userId,
      { from: day(spanStart), to: day(spanEnd) },
      repository,
    ),
    repository.findCategories(userId),
    repository.findItemCategories(userId),
    repository.findProducts(userId),
  ]);
  // O nome e a categoria do produto são os do catálogo, não os de uma linha
  const productById = new Map(products.map((product) => [product.id, product]));

  // Por item: cada linha soma na categoria do produto e em todas as de cima
  const itemById = new Map(itemCategories.map((item) => [item.id, item]));
  const itemTotals = new Map<string, number>();
  const addItem = (categoryId: string | null, value: number) => {
    let cursor = categoryId ? itemById.get(categoryId) : undefined;
    if (!cursor) {
      itemTotals.set('none', (itemTotals.get('none') ?? 0) + value);
      return;
    }
    for (
      ;
      cursor;
      cursor = cursor.parentId ? itemById.get(cursor.parentId) : undefined
    )
      itemTotals.set(cursor.id, (itemTotals.get(cursor.id) ?? 0) + value);
  };
  const itemTree = (parentId: string | null): CategoryTotal[] =>
    itemCategories
      .filter((item) => item.parentId === parentId && itemTotals.has(item.id))
      .map((item) => ({
        id: item.id,
        name: item.name,
        total: round(itemTotals.get(item.id) ?? 0),
        children: itemTree(item.id),
      }))
      .sort((a, b) => b.total - a.total);

  const target: ExpenseCurrency | null = await pickDisplayCurrency(
    query.currencyId,
    expenses.map((expense) => expense.currencyId),
    repository,
  );
  const converter = await currencyService.converter(
    target,
    expenses.map((expense) => ({
      currency: expense.currency,
      day: expense.date,
      hour: expense.rateHour,
    })),
  );
  const convert = converter.convert;

  const monthly = new Map<
    string,
    { month: string; paid: number; pending: number }
  >();
  for (
    let cursor = new Date(rangeStart);
    cursor <= rangeEnd;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  ) {
    const month = monthOf(cursor);
    monthly.set(month, { month, paid: 0, pending: 0 });
  }

  // Por categoria: cada despesa soma na dela e em todas as de cima
  const byId = new Map(categories.map((category) => [category.id, category]));
  const categoryTotals = new Map<string, number>();
  const addCategory = (categoryId: string | null, value: number) => {
    let cursor = categoryId ? byId.get(categoryId) : undefined;
    if (!cursor) {
      categoryTotals.set('none', (categoryTotals.get('none') ?? 0) + value);
      return;
    }
    for (
      ;
      cursor;
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
    )
      categoryTotals.set(
        cursor.id,
        (categoryTotals.get(cursor.id) ?? 0) + value,
      );
  };
  const categoryTree = (parentId: string | null): CategoryTotal[] =>
    categories
      .filter(
        (category) =>
          category.parentId === parentId && categoryTotals.has(category.id),
      )
      .map((category) => ({
        id: category.id,
        name: category.name,
        total: round(categoryTotals.get(category.id) ?? 0),
        children: categoryTree(category.id),
      }))
      .sort((a, b) => b.total - a.total);

  const byKind = new Map<string, number>();
  const byMerchant = new Map<
    string,
    { name: string; total: number; count: number }
  >();
  const byProduct = new Map<
    string,
    {
      id: string;
      name: string;
      total: number;
      quantity: number;
      count: number;
      lastPrice: number;
      lastDate: string;
    }
  >();
  let total = 0;
  let thisMonth = 0;
  let lastMonth = 0;
  let year = 0;
  let pending = 0;

  for (const expense of expenses) {
    const value = convert(
      expense.amount,
      expense.currency,
      expense.date,
      expense.rateHour,
    );
    const slot = monthly.get(expense.date.slice(0, 7));
    if (expense.status === 'pending') {
      if (slot) slot.pending += value;
      if (inCards(expense.date)) pending += value;
      continue;
    }
    if (slot) slot.paid += value;
    if (inCards(expense.date)) {
      total += value;
      if (expense.date.slice(0, 7) === currentMonth) thisMonth += value;
      if (expense.date.slice(0, 7) === previousMonth) lastMonth += value;
      if (expense.date.slice(0, 4) === currentMonth.slice(0, 4)) year += value;
    }
    if (!inRange(expense.date)) continue;
    byKind.set(expense.kind, (byKind.get(expense.kind) ?? 0) + value);

    if (expense.merchant) {
      const key = expense.merchant.toLowerCase();
      const merchant = byMerchant.get(key) ?? {
        name: expense.merchant,
        total: 0,
        count: 0,
      };
      merchant.total += value;
      merchant.count += 1;
      byMerchant.set(key, merchant);
    }

    addCategory(expense.categoryId, value);
    for (const item of expense.items) {
      const itemValue = convert(
        item.amount,
        expense.currency,
        expense.date,
        expense.rateHour,
      );
      const catalog = item.productId
        ? productById.get(item.productId)
        : undefined;
      addItem(catalog?.categoryId ?? null, itemValue);
      if (!item.productId) continue;
      const product = byProduct.get(item.productId) ?? {
        id: item.productId,
        name: catalog?.name ?? item.name,
        total: 0,
        quantity: 0,
        count: 0,
        lastPrice: 0,
        lastDate: '',
      };
      product.total += itemValue;
      product.quantity += item.quantity;
      product.count += 1;
      if (expense.date >= product.lastDate) {
        product.lastDate = expense.date;
        product.lastPrice = item.unitPrice;
      }
      byProduct.set(item.productId, product);
    }
  }

  return {
    currency: target,
    estimatedRates: converter.estimated(),
    months: [...monthly.values()].map((month) => ({
      ...month,
      paid: round(month.paid),
      pending: round(month.pending),
    })),
    cards: {
      total: round(total),
      thisMonth: round(thisMonth),
      lastMonth: round(lastMonth),
      year: round(year),
      monthlyAverage: round(total / months),
      pending: round(pending),
    },
    byCategory: [
      ...categoryTree(null),
      ...(categoryTotals.has('none')
        ? [
            {
              id: null,
              name: null,
              total: round(categoryTotals.get('none') ?? 0),
              children: [],
            },
          ]
        : []),
    ],
    byItem: [
      ...itemTree(null),
      ...(itemTotals.has('none')
        ? [
            {
              id: null,
              name: null,
              total: round(itemTotals.get('none') ?? 0),
              children: [],
            },
          ]
        : []),
    ],
    byKind: [...byKind.entries()]
      .map(([kind, value]) => ({ kind, total: round(value) }))
      .sort((a, b) => b.total - a.total),
    merchants: [...byMerchant.values()]
      .map((merchant) => ({ ...merchant, total: round(merchant.total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP),
    products: [...byProduct.values()]
      .map((product) => ({
        ...product,
        total: round(product.total),
        quantity: round(product.quantity),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP),
  };
}
