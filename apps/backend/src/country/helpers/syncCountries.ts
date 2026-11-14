import { PrismaCountryRepository } from '../repositories/prisma/prisma-country-repository';
import { CountryApiConfig, fetchAllCountries } from './countryStateCityClient';

export async function syncCountries(countryRepository: PrismaCountryRepository, api: CountryApiConfig) {
  const countries = await fetchAllCountries(api);

  for (const country of countries) {
    await countryRepository.upsert({
      apiId: String(country.id),
      name: country.name,
      iso2: country.iso2,
      iso3: country.iso3,
      phonecode: country.phonecode,
      capital: country.capital,
      currency: country.currency,
      native: country.native,
      emoji: country.emoji,
    });
  }

  return { synced: countries.length };
}
