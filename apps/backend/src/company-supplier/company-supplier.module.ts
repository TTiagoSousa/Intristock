import { Module } from '@nestjs/common';
import { CompanySupplierService } from './company-supplier.service';
import { CompanySupplierController } from './company-supplier.controller';
import { PrismaCompanySupplierRepository } from './repositories/prisma/prisma-company-supplier-repository';
import { CompanyModule } from 'src/company/company.module';
import { CountryModule } from 'src/country/country.module';
import { CurrencyModule } from 'src/currency/currency.module';
import { BankAccountModule } from 'src/bank-account/bank-account.module';
import { CompanySupplierGroupModule } from 'src/company-supplier-group/company-supplier-group.module';

@Module({
  imports: [
    CompanyModule,
    CountryModule,
    CurrencyModule,
    BankAccountModule,
    CompanySupplierGroupModule,
  ],
  controllers: [CompanySupplierController],
  providers: [
    CompanySupplierService,
    {
      provide: PrismaCompanySupplierRepository,
      useClass: PrismaCompanySupplierRepository,
    },
  ],
  exports: [PrismaCompanySupplierRepository],
})
export class CompanySupplierModule {}
