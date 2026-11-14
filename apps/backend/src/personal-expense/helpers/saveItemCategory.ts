import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaPersonalExpenseRepository } from '../repositories/prisma/prisma-personal-expense-repository';
import {
  CreateItemCategoryDto,
  UpdateItemCategoryDto,
} from '../dto/personal-expense.dto';

/**
 * Cria (sem `categoryId`) ou edita uma categoria de item. Pode ficar dentro de
 * qualquer outra, mas não dentro de si própria nem de uma das suas.
 */
export async function saveItemCategory(
  userId: string,
  categoryId: string | null,
  dto: CreateItemCategoryDto | UpdateItemCategoryDto,
  repository: PrismaPersonalExpenseRepository,
) {
  if (categoryId && !(await repository.findItemCategory(userId, categoryId)))
    throw new NotFoundException('Categoria não encontrada');

  if (dto.parentId) {
    const categories = await repository.findItemCategories(userId);
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
    return repository.createItemCategory(
      userId,
      (dto as CreateItemCategoryDto).name.trim(),
      dto.parentId ?? null,
    );
  const update = dto as UpdateItemCategoryDto;
  return repository.updateItemCategory(categoryId, {
    name: update.name?.trim(),
    isActive: update.isActive,
    parentId: update.parentId,
  });
}
