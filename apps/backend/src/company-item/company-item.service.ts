import { Injectable } from '@nestjs/common';
import { PrismaCompanyItemRepository } from './repositories/prisma/prisma-company-item-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanySupplierRepository } from 'src/company-supplier/repositories/prisma/prisma-company-supplier-repository';
import { createCompanyItem } from './helpers/createCompanyItem';
import { updateCompanyItem } from './helpers/updateCompanyItem';
import { deleteCompanyItem } from './helpers/deleteCompanyItem';
import { findCompanyItems } from './helpers/findCompanyItems';
import { findCompanyItemBySlug } from './helpers/findCompanyItemBySlug';
import { findPlatformPlansForItems } from './helpers/findPlatformPlansForItems';
import { createItemsFromPlans } from './helpers/createItemsFromPlans';
import { PrismaCurrencyRepository } from 'src/currency/repositories/prisma/prisma-currency-repository';
import { CurrencyService } from 'src/currency/currency.service';
import { CreateCompanyItemDto } from './dto/create-company-item.dto';
import { UpdateCompanyItemDto } from './dto/update-company-item.dto';

@Injectable()
export class CompanyItemService {
  constructor(
    private readonly itemRepository: PrismaCompanyItemRepository,
    private readonly companyRepository: PrismaCompanyRepository,
    private readonly supplierRepository: PrismaCompanySupplierRepository,
    private readonly currencyRepository: PrismaCurrencyRepository,
    private readonly currencyService: CurrencyService,
  ) {}

  // Os planos de uma plataforma do catálogo, com os que a empresa já tem
  findCatalogPlans(userId: string, companyId: string, platformId: string) {
    return findPlatformPlansForItems(
      userId,
      companyId,
      platformId,
      this.itemRepository,
      this.companyRepository,
    );
  }

  createFromPlans(
    userId: string,
    companyId: string,
    platformId: string,
    planIds: string[],
  ) {
    return createItemsFromPlans(
      userId,
      companyId,
      platformId,
      planIds,
      this.itemRepository,
      this.companyRepository,
      this.supplierRepository,
      this.currencyRepository,
      this.currencyService,
    );
  }

  async create(userId: string, companyId: string, dto: CreateCompanyItemDto) {
    return createCompanyItem(
      userId,
      companyId,
      dto,
      this.itemRepository,
      this.companyRepository,
      this.supplierRepository,
    );
  }

  async update(
    userId: string,
    companyId: string,
    itemId: string,
    dto: UpdateCompanyItemDto,
  ) {
    return updateCompanyItem(
      userId,
      companyId,
      itemId,
      dto,
      this.itemRepository,
      this.companyRepository,
      this.supplierRepository,
    );
  }

  async delete(userId: string, companyId: string, itemId: string) {
    return deleteCompanyItem(
      userId,
      companyId,
      itemId,
      this.itemRepository,
      this.companyRepository,
    );
  }

  async findBySlug(userId: string, companyId: string, slug: string) {
    return findCompanyItemBySlug(
      userId,
      companyId,
      slug,
      this.itemRepository,
      this.companyRepository,
    );
  }

  async findAll(
    userId: string,
    companyId: string,
    pagination: { skip: number; take: number },
  ) {
    return findCompanyItems(
      userId,
      companyId,
      this.itemRepository,
      this.companyRepository,
      pagination,
    );
  }
}
