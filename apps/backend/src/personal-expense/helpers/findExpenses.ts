import { PrismaPersonalExpenseRepository } from '../repositories/prisma/prisma-personal-expense-repository';
import { ExpensesQueryDto } from '../dto/personal-expense.dto';

/**
 * As despesas da pessoa, da mais recente à mais antiga, com os números em
 * número. Uma categoria no filtro conta com todas as de dentro, a qualquer nível.
 */
export async function findExpenses(
  userId: string,
  query: ExpensesQueryDto,
  repository: PrismaPersonalExpenseRepository,
) {
  let categoryIds: string[] | undefined;
  if (query.categoryId) {
    const categories = await repository.findCategories(userId);
    const ids = new Set([query.categoryId]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const category of categories)
        if (
          category.parentId &&
          ids.has(category.parentId) &&
          !ids.has(category.id)
        ) {
          ids.add(category.id);
          grew = true;
        }
    }
    categoryIds = [...ids];
  }

  const expenses = await repository.findExpenses(userId, {
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
    kind: query.kind,
    categoryIds,
    q: query.q,
  });

  return expenses.map((expense) => ({
    ...expense,
    date: expense.date.toISOString().slice(0, 10),
    amount: Number(expense.amount),
    items: expense.items.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      amount: Number(item.amount),
    })),
  }));
}
