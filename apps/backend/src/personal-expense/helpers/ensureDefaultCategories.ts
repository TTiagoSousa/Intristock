import { PrismaPersonalExpenseRepository } from '../repositories/prisma/prisma-personal-expense-repository';
import { addDefaultCategories } from './addDefaultCategories';

/** Na primeira vez que a pessoa abre as despesas, cria as categorias por omissão. */
export async function ensureDefaultCategories(
  userId: string,
  repository: PrismaPersonalExpenseRepository,
) {
  if ((await repository.countCategories(userId)) > 0) return;
  await addDefaultCategories(userId, repository);
}
