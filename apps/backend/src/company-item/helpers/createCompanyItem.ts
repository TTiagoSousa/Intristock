import { ConflictException } from '@nestjs/common';
import { PrismaCompanyItemRepository } from '../repositories/prisma/prisma-company-item-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanySupplierRepository } from 'src/company-supplier/repositories/prisma/prisma-company-supplier-repository';
import {
  assertCompanyOwnership,
  assertItemKind,
  assertItemRelations,
} from './assertItemInput';
import { CreateCompanyItemDto } from '../dto/create-company-item.dto';
import { generateItemSlug } from './generateItemSlug';

export async function createCompanyItem(
  userId: string,
  companyId: string,
  dto: CreateCompanyItemDto,
  itemRepository: PrismaCompanyItemRepository,
  companyRepository: PrismaCompanyRepository,
  supplierRepository: PrismaCompanySupplierRepository,
) {
  await assertCompanyOwnership(userId, companyId, companyRepository, 'items.create');
  await assertItemRelations(companyId, dto, supplierRepository);
  assertItemKind(dto);

  const existing = await itemRepository.findByCompanyAndName(
    companyId,
    dto.name,
  );

  if (existing) {
    throw new ConflictException('Já existe um item com este nome');
  }

  // O slug do URL, feito a partir do nome
  const slug = await generateItemSlug(companyId, dto.name, itemRepository);

  return itemRepository.create({ ...dto, companyId, slug });
}
