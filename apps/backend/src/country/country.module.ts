import { Module } from '@nestjs/common';
import { CountryService } from './country.service';
import { CountryController } from './country.controller';
import { PrismaCountryRepository } from './repositories/prisma/prisma-country-repository';
import { AppSettingModule } from 'src/app-setting/app-setting.module';
import { CatalogSeedModule } from 'src/catalog-seed/catalog-seed.module';

@Module({
  // A API vem das definições; depois de sincronizar, entram os impostos e as
  // plataformas pré-definidos dos países que acabaram de chegar
  imports: [AppSettingModule, CatalogSeedModule],
  controllers: [CountryController],
  providers: [
    CountryService,
    {
      provide: PrismaCountryRepository,
      useClass: PrismaCountryRepository,
    },
  ],
  exports: [PrismaCountryRepository],
})
export class CountryModule {}
