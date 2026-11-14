import { Module } from '@nestjs/common';
import { CompanyItemService } from './company-item.service';
import { CompanyItemController } from './company-item.controller';
import { PrismaCompanyItemRepository } from './repositories/prisma/prisma-company-item-repository';
import { CompanyModule as CompanyDomainModule } from 'src/company/company.module';
import { CompanySupplierModule } from 'src/company-supplier/company-supplier.module';
import { CurrencyModule } from 'src/currency/currency.module';

@Module({
  imports: [CompanyDomainModule, CompanySupplierModule, CurrencyModule],
  controllers: [CompanyItemController],
  providers: [
    CompanyItemService,
    {
      provide: PrismaCompanyItemRepository,
      useClass: PrismaCompanyItemRepository,
    },
  ],
  exports: [PrismaCompanyItemRepository],
})
export class CompanyItemModule {}
