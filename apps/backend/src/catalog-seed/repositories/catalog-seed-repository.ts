export interface CatalogSeedRepository {
  countryIdsByIso2(iso2: string[]): Promise<Map<string, string>>;
  existingTaxKeys(): Promise<Set<string>>;
  existingPlatformNames(): Promise<Set<string>>;
  existingCalculatorAbbreviations(): Promise<Set<string>>;
  existingModuleNames(): Promise<Set<string>>;
  createTaxes(
    data: { countryId: string; name: string; rate: number; category: string; description: string }[],
  ): Promise<number>;
  createPlatforms(data: { name: string; type: string; website: string; countryId: string | null }[]): Promise<number>;
  createCalculators(data: { abbreviation: string; name: string; description: string }[]): Promise<number>;
  createModules(data: { name: string; label: string; description: string; icon: string }[]): Promise<number>;
}
