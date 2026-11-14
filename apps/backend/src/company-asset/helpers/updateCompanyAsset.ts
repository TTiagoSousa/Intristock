import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaCompanyAssetRepository } from '../repositories/prisma/prisma-company-asset-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCurrencyRepository } from 'src/currency/repositories/prisma/prisma-currency-repository';
import { PrismaCompanyItemRepository } from 'src/company-item/repositories/prisma/prisma-company-item-repository';
import { UpdateCompanyAssetDto } from '../dto/update-company-asset.dto';
import {
  assertAssetRelations,
  assertCompanyOwnership,
} from './assertAssetInput';
import { CompanyAssetData } from '../repositories/company-asset-repository';

export async function updateCompanyAsset(
  userId: string,
  companyId: string,
  assetId: string,
  dto: UpdateCompanyAssetDto,
  assetRepository: PrismaCompanyAssetRepository,
  companyRepository: PrismaCompanyRepository,
  currencyRepository: PrismaCurrencyRepository,
  itemRepository: PrismaCompanyItemRepository,
) {
  const company = await assertCompanyOwnership(
    userId,
    companyId,
    companyRepository,
    'assets.edit',
  );

  const asset = await assetRepository.findById(assetId);

  if (!asset || asset.companyId !== companyId) {
    throw new NotFoundException('Ativo não encontrado');
  }

  // Mesma regra da criação: a empresa trabalha só na moeda dela
  if (dto.currencyId && dto.currencyId !== company.currencyId) {
    throw new BadRequestException('Um ativo só pode ser na moeda da empresa');
  }

  await assertAssetRelations(
    companyId,
    dto,
    currencyRepository,
    itemRepository,
    assetRepository,
  );

  // Sair de circulação exige a data: sem ela não se sabe até quando amortizou,
  // e a mais ou menos-valia ficava sem termo de comparação
  const leaving = dto.status === 'abatido' || dto.status === 'vendido';
  const disposedAt =
    dto.disposedAt ??
    (asset.disposedAt ? asset.disposedAt.toISOString() : undefined);

  if (leaving && !disposedAt) {
    throw new BadRequestException(
      'Tens de indicar a data do abate ou da venda',
    );
  }

  const data: CompanyAssetData = {};

  if (dto.name !== undefined) data.name = dto.name;
  if (dto.category !== undefined) data.category = dto.category;
  if (dto.acquisitionDate !== undefined)
    data.acquisitionDate = new Date(dto.acquisitionDate);
  if (dto.acquisitionValue !== undefined)
    data.acquisitionValue = dto.acquisitionValue;
  if (dto.currencyId !== undefined) data.currencyId = dto.currencyId;
  if (dto.depreciationRate !== undefined)
    data.depreciationRate = dto.depreciationRate;
  if (dto.usefulLifeHours !== undefined)
    data.usefulLifeHours = dto.usefulLifeHours;
  if (dto.residualValue !== undefined) data.residualValue = dto.residualValue;
  if (dto.itemId !== undefined) data.itemId = dto.itemId;
  if (dto.paymentId !== undefined) data.paymentId = dto.paymentId;
  if (dto.notes !== undefined) data.notes = dto.notes;
  if (dto.status !== undefined) data.status = dto.status;
  if (dto.disposedAt !== undefined) data.disposedAt = new Date(dto.disposedAt);
  if (dto.disposalValue !== undefined) data.disposalValue = dto.disposalValue;

  return assetRepository.update(assetId, data);
}
