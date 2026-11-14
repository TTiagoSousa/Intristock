import { Injectable } from '@nestjs/common';
import { PrismaCompanyAssetRepository } from './repositories/prisma/prisma-company-asset-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCurrencyRepository } from 'src/currency/repositories/prisma/prisma-currency-repository';
import { PrismaCompanyItemRepository } from 'src/company-item/repositories/prisma/prisma-company-item-repository';
import { createCompanyAsset } from './helpers/createCompanyAsset';
import { updateCompanyAsset } from './helpers/updateCompanyAsset';
import { deleteCompanyAsset } from './helpers/deleteCompanyAsset';
import { findCompanyAssets } from './helpers/findCompanyAssets';
import { CreateCompanyAssetDto } from './dto/create-company-asset.dto';
import { UpdateCompanyAssetDto } from './dto/update-company-asset.dto';

@Injectable()
export class CompanyAssetService {
  constructor(
    private readonly assetRepository: PrismaCompanyAssetRepository,
    private readonly companyRepository: PrismaCompanyRepository,
    private readonly currencyRepository: PrismaCurrencyRepository,
    private readonly itemRepository: PrismaCompanyItemRepository,
  ) {}

  async create(userId: string, companyId: string, dto: CreateCompanyAssetDto) {
    return createCompanyAsset(
      userId,
      companyId,
      dto,
      this.assetRepository,
      this.companyRepository,
      this.currencyRepository,
      this.itemRepository,
    );
  }

  async update(userId: string, companyId: string, assetId: string, dto: UpdateCompanyAssetDto) {
    return updateCompanyAsset(
      userId,
      companyId,
      assetId,
      dto,
      this.assetRepository,
      this.companyRepository,
      this.currencyRepository,
      this.itemRepository,
    );
  }

  async delete(userId: string, companyId: string, assetId: string) {
    return deleteCompanyAsset(
      userId,
      companyId,
      assetId,
      this.assetRepository,
      this.companyRepository,
    );
  }

  async findAll(
    userId: string,
    companyId: string,
    pagination: { skip: number; take: number },
  ) {
    return findCompanyAssets(
      userId,
      companyId,
      this.assetRepository,
      this.companyRepository,
      pagination,
    );
  }
}
