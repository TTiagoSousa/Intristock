import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaPersonalExpenseRepository } from '../repositories/prisma/prisma-personal-expense-repository';
import {
  CreateProductDto,
  UpdateProductDto,
} from '../dto/personal-expense.dto';

const clean = (value: string | null | undefined) =>
  value === undefined ? undefined : value?.trim() || null;

/**
 * Cria (sem `productId`) ou edita um item do catálogo: o nome (um só por nome,
 * sem contar maiúsculas), a marca, a unidade e a categoria de item.
 */
export async function saveProduct(
  userId: string,
  productId: string | null,
  dto: CreateProductDto | UpdateProductDto,
  repository: PrismaPersonalExpenseRepository,
) {
  if (productId && !(await repository.findProduct(userId, productId)))
    throw new NotFoundException('Item não encontrado');
  if (
    dto.categoryId &&
    !(await repository.findItemCategory(userId, dto.categoryId))
  )
    throw new NotFoundException('Categoria não encontrada');

  const name = dto.name?.trim();
  if (name) {
    const same = await repository.findProductByName(userId, name);
    if (same && same.id !== productId)
      throw new ConflictException('Já tens um item com este nome');
  }

  const data = {
    name,
    brand: clean(dto.brand),
    unit: clean(dto.unit),
    categoryId: dto.categoryId,
  };
  return productId
    ? repository.updateProduct(productId, data)
    : repository.createProduct(userId, data);
}
