import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaPersonalExpenseRepository } from '../repositories/prisma/prisma-personal-expense-repository';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from '../dto/personal-expense.dto';

/**
 * Cria (sem `categoryId`) ou edita uma categoria das despesas. Pode ficar dentro
 * de qualquer outra, mas não dentro de si própria nem de uma das suas.
 */
export async function saveExpenseCategory(
  userId: string,
  categoryId: string | null,
  dto: CreateExpenseCategoryDto | UpdateExpenseCategoryDto,
  repository: PrismaPersonalExpenseRepository,
) {
  if (categoryId && !(await repository.findCategory(userId, categoryId)))
    throw new NotFoundException('Categoria não encontrada');

  if (dto.parentId) {
    const categories = await repository.findCategories(userId);
    const byId = new Map(categories.map((category) => [category.id, category]));
    if (!byId.has(dto.parentId))
      throw new NotFoundException('Categoria não encontrada');
    // Subir da nova mãe até à raiz sem passar pela própria
    for (
      let cursor = byId.get(dto.parentId);
      cursor;
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
    )
      if (cursor.id === categoryId)
        throw new BadRequestException(
          'Uma categoria não fica dentro de si própria',
        );
  }

  if (!categoryId)
    return repository.createCategory(
      userId,
      (dto as CreateExpenseCategoryDto).name.trim(),
      dto.parentId ?? null,
    );
  const update = dto as UpdateExpenseCategoryDto;
  return repository.updateCategory(categoryId, {
    name: update.name?.trim(),
    isActive: update.isActive,
    parentId: update.parentId,
  });
}
