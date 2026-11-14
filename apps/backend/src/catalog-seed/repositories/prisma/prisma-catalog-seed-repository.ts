import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CatalogSeedRepository } from '../catalog-seed-repository';

@Injectable()
export class PrismaCatalogSeedRepository implements CatalogSeedRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countryIdsByIso2(iso2: string[]): Promise<Map<string, string>> {
    const countries = await this.prisma.country.findMany({
      where: { iso2: { in: iso2 } },
      select: { id: true, iso2: true },
    });
    return new Map(countries.map((c) => [c.iso2, c.id]));
  }

  async existingTaxKeys(): Promise<Set<string>> {
    const taxes = await this.prisma.tax.findMany({ select: { countryId: true, name: true } });
    return new Set(taxes.map((t) => `${t.countryId}|${t.name.toLowerCase()}`));
  }

  async existingPlatformNames(): Promise<Set<string>> {
    const platforms = await this.prisma.platform.findMany({ select: { name: true } });
    return new Set(platforms.map((p) => p.name.toLowerCase()));
  }

  async existingCalculatorAbbreviations(): Promise<Set<string>> {
    const calculators = await this.prisma.calculator.findMany({ select: { abbreviation: true } });
    return new Set(calculators.map((c) => c.abbreviation));
  }

  async existingModuleNames(): Promise<Set<string>> {
    const modules = await this.prisma.module.findMany({ select: { name: true } });
    return new Set(modules.map((m) => m.name));
  }

  async createTaxes(
    data: { countryId: string; name: string; rate: number; category: string; description: string }[],
  ): Promise<number> {
    if (data.length === 0) return 0;
    const result = await this.prisma.tax.createMany({ data: data.map((tax) => ({ ...tax, type: 'system' })) });
    return result.count;
  }

  async createPlatforms(
    data: { name: string; type: string; website: string; countryId: string | null }[],
  ): Promise<number> {
    if (data.length === 0) return 0;
    // As do catálogo dizem de onde vieram: o atualizar das APIs não lhes mexe
    const result = await this.prisma.platform.createMany({
      data: data.map((platform) => ({ ...platform, source: 'system' })),
    });
    return result.count;
  }

  async createCalculators(data: { abbreviation: string; name: string; description: string }[]): Promise<number> {
    if (data.length === 0) return 0;
    const result = await this.prisma.calculator.createMany({ data });
    return result.count;
  }

  async createModules(data: { name: string; label: string; description: string; icon: string }[]): Promise<number> {
    if (data.length === 0) return 0;
    const result = await this.prisma.module.createMany({ data });
    return result.count;
  }
}
