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

  const data = {
    name: dto.name?.trim(),
    brand: clean(dto.brand),
    unit: clean(dto.unit),
    categoryId: dto.categoryId,
  };
  // A procura do nome e a gravação vão juntas, com um trinco por nome: dois pedidos ao
  // mesmo tempo não criam dois itens iguais
  const product = await repository.saveProductWithUniqueName(userId, productId, data);
  if (!product) throw new ConflictException('Já tens um item com este nome');
  return product;
}
