import { Injectable } from '@nestjs/common';
import { PrismaTaxRepository } from './repositories/prisma/prisma-tax-repository';
import { PrismaCountryRepository } from 'src/country/repositories/prisma/prisma-country-repository';
import { createTax } from './helpers/createTax';
import { findAllTaxes } from './helpers/findAllTaxes';
import { CreateTaxDto } from './dto/create-tax.dto';

@Injectable()
export class TaxService {
  constructor(
    private readonly taxRepository: PrismaTaxRepository,
    private readonly countryRepository: PrismaCountryRepository,
  ) {}

  async create(dto: CreateTaxDto) {
    return createTax(dto, this.taxRepository, this.countryRepository);
  }

  async findAll(countryId?: string) {
    return findAllTaxes(countryId, this.taxRepository);
  }
}
