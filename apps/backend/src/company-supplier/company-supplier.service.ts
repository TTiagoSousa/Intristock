import { Injectable } from '@nestjs/common';
import { PrismaCompanySupplierRepository } from './repositories/prisma/prisma-company-supplier-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCountryRepository } from 'src/country/repositories/prisma/prisma-country-repository';
import { PrismaCurrencyRepository } from 'src/currency/repositories/prisma/prisma-currency-repository';
import { PrismaBankAccountRepository } from 'src/bank-account/repositories/prisma/prisma-bank-account-repository';
import { PrismaCompanySupplierGroupRepository } from 'src/company-supplier-group/repositories/prisma/prisma-company-supplier-group-repository';
import { createCompanySupplier } from './helpers/createCompanySupplier';
import { findCompanySuppliers } from './helpers/findCompanySuppliers';
import { updateCompanySupplier } from './helpers/updateCompanySupplier';
import { findCompanySupplierBySlug } from './helpers/findCompanySupplierBySlug';
import { deleteCompanySupplier } from './helpers/deleteCompanySupplier';
import { findSupplierCatalog } from './helpers/findSupplierCatalog';
import { createSupplierFromPlatform } from './helpers/createSupplierFromPlatform';
import { CreateCompanySupplierDto } from './dto/create-company-supplier.dto';
import { UpdateCompanySupplierDto } from './dto/update-company-supplier.dto';

@Injectable()
export class CompanySupplierService {
  constructor(
    private readonly companySupplierRepository: PrismaCompanySupplierRepository,
    private readonly companyRepository: PrismaCompanyRepository,
    private readonly countryRepository: PrismaCountryRepository,
    private readonly currencyRepository: PrismaCurrencyRepository,
    private readonly bankAccountRepository: PrismaBankAccountRepository,
    private readonly companySupplierGroupRepository: PrismaCompanySupplierGroupRepository,
  ) {}

  async create(
    userId: string,
    companyId: string,
    dto: CreateCompanySupplierDto,
  ) {
    return createCompanySupplier(
      userId,
      companyId,
      dto,
      this.companySupplierRepository,
      this.companyRepository,
      this.countryRepository,
      this.currencyRepository,
      this.bankAccountRepository,
      this.companySupplierGroupRepository,
    );
  }

  async update(
    userId: string,
    companyId: string,
    supplierId: string,
    dto: UpdateCompanySupplierDto,
  ) {
    return updateCompanySupplier(
      userId,
      companyId,
      supplierId,
      dto,
      this.companySupplierRepository,
      this.companyRepository,
      this.countryRepository,
      this.currencyRepository,
      this.bankAccountRepository,
      this.companySupplierGroupRepository,
    );
  }

  // O catálogo de uma categoria, com os que a empresa já tem
  findCatalog(userId: string, companyId: string, type: string) {
    return findSupplierCatalog(
      userId,
      companyId,
      type,
      this.companySupplierRepository,
      this.companyRepository,
    );
  }

  createFromPlatform(userId: string, companyId: string, platformId: string) {
    return createSupplierFromPlatform(
      userId,
      companyId,
      platformId,
      this.companySupplierRepository,
      this.companyRepository,
    );
  }

  async findBySlug(userId: string, companyId: string, slug: string) {
    return findCompanySupplierBySlug(
      userId,
      companyId,
      slug,
      this.companySupplierRepository,
      this.companyRepository,
    );
  }

  async remove(userId: string, companyId: string, supplierId: string) {
    return deleteCompanySupplier(
      userId,
      companyId,
      supplierId,
      this.companySupplierRepository,
      this.companyRepository,
    );
  }

  async findAll(
    userId: string,
    companyId: string,
    pagination: { skip: number; take: number },
  ) {
    return findCompanySuppliers(
      userId,
      companyId,
      this.companySupplierRepository,
      this.companyRepository,
      pagination,
    );
  }
}
