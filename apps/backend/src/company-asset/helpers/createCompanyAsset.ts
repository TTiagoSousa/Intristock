import { BadRequestException } from '@nestjs/common';
import { PrismaCompanyAssetRepository } from '../repositories/prisma/prisma-company-asset-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCurrencyRepository } from 'src/currency/repositories/prisma/prisma-currency-repository';
import { PrismaCompanyItemRepository } from 'src/company-item/repositories/prisma/prisma-company-item-repository';
import { CreateCompanyAssetDto } from '../dto/create-company-asset.dto';
import {
  assertAssetRelations,
  assertCompanyOwnership,
} from './assertAssetInput';

export async function createCompanyAsset(
  userId: string,
  companyId: string,
  dto: CreateCompanyAssetDto,
  assetRepository: PrismaCompanyAssetRepository,
  companyRepository: PrismaCompanyRepository,
  currencyRepository: PrismaCurrencyRepository,
  itemRepository: PrismaCompanyItemRepository,
) {
  const company = await assertCompanyOwnership(
    userId,
    companyId,
    companyRepository,
    'assets.create',
  );
  await assertAssetRelations(
    companyId,
    dto,
    currencyRepository,
    itemRepository,
    assetRepository,
  );

  // A empresa trabalha só na moeda dela. O campo continua a existir na ficha,
  // mas vem fixo — um ativo noutra moeda entrava nos totais como se fosse
  // desta, e não há conversão em lado nenhum para o corrigir.
  if (dto.currencyId && dto.currencyId !== company.currencyId) {
    throw new BadRequestException('Um ativo só pode ser na moeda da empresa');
  }

  return assetRepository.create({
    companyId,
    name: dto.name,
    category: dto.category,
    acquisitionDate: new Date(dto.acquisitionDate),
    acquisitionValue: dto.acquisitionValue,
    currencyId: company.currencyId,
    depreciationRate: dto.depreciationRate,
    usefulLifeHours: dto.usefulLifeHours ?? null,
    residualValue: dto.residualValue ?? null,
    paymentId: dto.paymentId ?? null,
    itemId: dto.itemId ?? null,
    notes: dto.notes ?? null,
  });
}
