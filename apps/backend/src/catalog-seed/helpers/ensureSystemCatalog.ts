import { PrismaCatalogSeedRepository } from '../repositories/prisma/prisma-catalog-seed-repository';
import { SYSTEM_CALCULATORS, SYSTEM_MODULES, SYSTEM_PLATFORMS, SYSTEM_TAXES } from '../data/systemCatalog';

/**
 * Cria o que falta do catálogo pré-definido e devolve quantas linhas entraram.
 * Corre no arranque e depois de cada sincronização de países: o que depende de
 * um país só entra quando ele existe. Nunca altera nem apaga o que já lá está.
 */
export async function ensureSystemCatalog(repository: PrismaCatalogSeedRepository) {
  const iso2 = [
    ...new Set([
      ...SYSTEM_TAXES.map((t) => t.countryIso2),
      ...SYSTEM_PLATFORMS.flatMap((p) => (p.countryIso2 ? [p.countryIso2] : [])),
    ]),
  ];
  const [countryIds, taxKeys, platformNames, calculatorAbbreviations, moduleNames] = await Promise.all([
    repository.countryIdsByIso2(iso2),
    repository.existingTaxKeys(),
    repository.existingPlatformNames(),
    repository.existingCalculatorAbbreviations(),
    repository.existingModuleNames(),
  ]);

  const taxes = SYSTEM_TAXES.flatMap((tax) => {
    const countryId = countryIds.get(tax.countryIso2);
    if (!countryId || taxKeys.has(`${countryId}|${tax.name.toLowerCase()}`)) return [];
    return [{ countryId, name: tax.name, rate: tax.rate, category: tax.category, description: tax.description }];
  });

  const platforms = SYSTEM_PLATFORMS.flatMap((platform) => {
    const countryId = platform.countryIso2 ? countryIds.get(platform.countryIso2) : null;
    if (platform.countryIso2 && !countryId) return [];
    if (platformNames.has(platform.name.toLowerCase())) return [];
    return [{ name: platform.name, type: platform.type, website: platform.website, countryId: countryId ?? null }];
  });

  const calculators = SYSTEM_CALCULATORS.filter((c) => !calculatorAbbreviations.has(c.abbreviation));

  const modules = SYSTEM_MODULES.filter((m) => !moduleNames.has(m.name));

  const [taxesCreated, platformsCreated, calculatorsCreated, modulesCreated] = await Promise.all([
    repository.createTaxes(taxes),
    repository.createPlatforms(platforms),
    repository.createCalculators(calculators),
    repository.createModules(modules),
  ]);

  return { taxes: taxesCreated, platforms: platformsCreated, calculators: calculatorsCreated, modules: modulesCreated };
}
