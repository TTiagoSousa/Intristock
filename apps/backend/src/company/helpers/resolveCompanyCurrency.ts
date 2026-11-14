import { BadRequestException } from '@nestjs/common';
import { PrismaCountryRepository } from 'src/country/repositories/prisma/prisma-country-repository';
import { PrismaCurrencyRepository } from 'src/currency/repositories/prisma/prisma-currency-repository';

// A moeda com que se fica quando não há nada melhor a dizer
const FALLBACK_SHORT_CODE = 'EUR';

/**
 * Qual é a moeda base de uma empresa a ser criada.
 *
 * Por ordem: a que foi escolhida, a do país (o `Country` já traz o código da
 * moeda dele), e o euro como último recurso. Assim quem cria uma empresa
 * portuguesa não tem de escolher nada, e quem cria uma no Brasil não fica com
 * euros por descuido.
 */
export async function resolveCompanyCurrencyId(
  dto: { currencyId?: string; countryId?: string },
  countryRepository: PrismaCountryRepository,
  currencyRepository: PrismaCurrencyRepository,
): Promise<string> {
  if (dto.currencyId) {
    const currency = await currencyRepository.findById(dto.currencyId);

    if (!currency) {
      throw new BadRequestException('Moeda inválida');
    }

    return currency.id;
  }

  if (dto.countryId) {
    const country = await countryRepository.findById(dto.countryId);
    // O país já foi validado antes de chegar aqui; o `shortCode` é que pode não
    // corresponder a nenhuma moeda sincronizada
    const fromCountry = country?.currency
      ? await currencyRepository.findByShortCode(country.currency)
      : null;

    if (fromCountry) return fromCountry.id;
  }

  const fallback = await currencyRepository.findByShortCode(FALLBACK_SHORT_CODE);

  if (!fallback) {
    throw new BadRequestException(
      'Não há moedas na base de dados — corre o seed ou o POST /currency/sync antes de criar empresas',
    );
  }

  return fallback.id;
}
