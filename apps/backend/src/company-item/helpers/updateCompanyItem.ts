import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaCompanyItemRepository } from '../repositories/prisma/prisma-company-item-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanySupplierRepository } from 'src/company-supplier/repositories/prisma/prisma-company-supplier-repository';
import {
  assertCompanyOwnership,
  assertItemKind,
  assertItemRelations,
} from './assertItemInput';
import { UpdateCompanyItemDto } from '../dto/update-company-item.dto';
import { generateItemSlug } from './generateItemSlug';

export async function updateCompanyItem(
  userId: string,
  companyId: string,
  itemId: string,
  dto: UpdateCompanyItemDto,
  itemRepository: PrismaCompanyItemRepository,
  companyRepository: PrismaCompanyRepository,
  supplierRepository: PrismaCompanySupplierRepository,
) {
  await assertCompanyOwnership(userId, companyId, companyRepository, 'items.edit');

  const item = await itemRepository.findById(itemId);

  if (!item || item.companyId !== companyId) {
    throw new NotFoundException('Item não encontrado');
  }

  // O `isRecurring` pode não vir no body — vale o que vier ou o já guardado
  await assertItemRelations(
    companyId,
    { ...dto, isRecurring: dto.isRecurring ?? item.isRecurring },
    supplierRepository,
  );

  // O `kind` pode não vir no PATCH — vale o que vier ou o já guardado
  const kind = dto.kind ?? item.kind;

  // Ao deixar de ser stock, a unidade e o rácio guardados deixam de valer: se
  // ficassem, a própria validação bloqueava a mudança de tipo
  const clearedStock =
    kind === 'stock' ? {} : { stockUnit: null, stockPerUnit: null };

  assertItemKind({
    kind,
    stockUnit: kind === 'stock' ? (dto.stockUnit ?? item.stockUnit) : undefined,
    stockPerUnit:
      kind === 'stock'
        ? (dto.stockPerUnit ??
          (item.stockPerUnit === null ? null : Number(item.stockPerUnit)))
        : undefined,
  });

  if (dto.name && dto.name !== item.name) {
    const existing = await itemRepository.findByCompanyAndName(
      companyId,
      dto.name,
    );

    if (existing) {
      throw new ConflictException('Já existe um item com este nome');
    }
  }

  // Ao deixar de ser recorrente, o período e o valor de subscrição deixam de
  // fazer sentido — se ficassem, o item guardava um preço que já não existe
  const clearedRecurrence =
    dto.isRecurring === false
      ? { recurrencePeriod: null, defaultPrice: null }
      : {};

  // Um nome novo muda o slug do URL com ele
  const slug =
    dto.name !== undefined && dto.name !== item.name
      ? await generateItemSlug(companyId, dto.name, itemRepository, itemId)
      : undefined;

  return itemRepository.update(itemId, {
    ...dto,
    slug,
    ...clearedRecurrence,
    ...clearedStock,
  });
}
