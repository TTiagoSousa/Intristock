import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { PrismaCompanyRepository } from './repositories/prisma/prisma-company-repository';
import { CountryModule } from 'src/country/country.module';
import { CurrencyModule } from 'src/currency/currency.module';
import { PlatformModule } from 'src/platform/platform.module';

@Module({
  imports: [CountryModule, CurrencyModule, PlatformModule],
  controllers: [CompanyController],
  providers: [
    CompanyService,
    {
      provide: PrismaCompanyRepository,
      useClass: PrismaCompanyRepository,
    },
  ],
  exports: [PrismaCompanyRepository],
})
export class CompanyModule {}
