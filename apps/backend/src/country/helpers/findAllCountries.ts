import { PrismaCountryRepository } from '../repositories/prisma/prisma-country-repository';

export async function findAllCountries(countryRepository: PrismaCountryRepository) {
  return countryRepository.findAll();
}
