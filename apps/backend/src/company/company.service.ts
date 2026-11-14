import { Injectable } from '@nestjs/common';
import { PrismaCompanyRepository } from './repositories/prisma/prisma-company-repository';
import { PrismaCountryRepository } from 'src/country/repositories/prisma/prisma-country-repository';
import { PrismaCurrencyRepository } from 'src/currency/repositories/prisma/prisma-currency-repository';
import { PrismaPlatformRepository } from 'src/platform/repositories/prisma/prisma-platform-repository';
import { createCompany } from './helpers/createCompany';
import { findUserCompanies } from './helpers/findUserCompanies';
import { updateCompany } from './helpers/updateCompany';
import { updateCompanyStatus } from './helpers/updateCompanyStatus';
import { deleteCompany } from './helpers/deleteCompany';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanyStatusDto } from './dto/update-company-status.dto';

@Injectable()
export class CompanyService {
  constructor(
    private readonly companyRepository: PrismaCompanyRepository,
    private readonly countryRepository: PrismaCountryRepository,
    private readonly currencyRepository: PrismaCurrencyRepository,
    private readonly platformRepository: PrismaPlatformRepository,
  ) {}

  async create(userId: string, dto: CreateCompanyDto) {
    return createCompany(
      userId,
      dto,
      this.companyRepository,
      this.countryRepository,
      this.currencyRepository,
      this.platformRepository,
    );
  }

  async update(userId: string, companyId: string, dto: UpdateCompanyDto) {
    return updateCompany(
      userId,
      companyId,
      dto,
      this.companyRepository,
      this.countryRepository,
      this.currencyRepository,
    );
  }

  async updateStatus(
    userId: string,
    companyId: string,
    dto: UpdateCompanyStatusDto,
  ) {
    return updateCompanyStatus(userId, companyId, dto, this.companyRepository);
  }

  async remove(userId: string, companyId: string) {
    return deleteCompany(userId, companyId, this.companyRepository);
  }

  async findAll(userId: string) {
    return findUserCompanies(userId, this.companyRepository);
  }
}
