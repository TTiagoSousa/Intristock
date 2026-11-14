import { PrismaTaxRepository } from '../repositories/prisma/prisma-tax-repository';

// Sem countryId devolve todos os impostos ativos; com countryId filtra pelo país
export async function findAllTaxes(countryId: string | undefined, taxRepository: PrismaTaxRepository) {
  if (countryId) {
    return taxRepository.findAllByCountryId(countryId);
  }

  return taxRepository.findAll();
}
