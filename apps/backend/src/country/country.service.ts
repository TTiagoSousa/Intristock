import { Injectable } from '@nestjs/common';
import { PrismaCountryRepository } from './repositories/prisma/prisma-country-repository';
import { AppSettingService } from 'src/app-setting/app-setting.service';
import { CatalogSeedService } from 'src/catalog-seed/catalog-seed.service';
import { syncCountries } from './helpers/syncCountries';
import { findAllCountries } from './helpers/findAllCountries';

@Injectable()
export class CountryService {
  constructor(
    private readonly countryRepository: PrismaCountryRepository,
    private readonly appSettingService: AppSettingService,
    private readonly catalogSeedService: CatalogSeedService,
  ) {}

  async sync() {
    const result = await syncCountries(this.countryRepository, await this.appSettingService.apiConfig('country'));
    // Os impostos e as plataformas de um país só entram quando ele existe
    const catalog = await this.catalogSeedService.ensure();
    return { ...result, catalog };
  }

  async findAll() {
    return findAllCountries(this.countryRepository);
  }
}
