import { BadRequestException } from '@nestjs/common';
import { PrismaTaxRepository } from '../repositories/prisma/prisma-tax-repository';
import { PrismaCountryRepository } from 'src/country/repositories/prisma/prisma-country-repository';
import { CreateTaxDto } from '../dto/create-tax.dto';

export async function createTax(
  dto: CreateTaxDto,
  taxRepository: PrismaTaxRepository,
  countryRepository: PrismaCountryRepository,
) {
  const country = await countryRepository.findById(dto.countryId);

  if (!country) {
    throw new BadRequestException('País inválido');
  }

  return taxRepository.create(dto);
}
