import { Module } from '@nestjs/common';
import { CompanyStockService } from './company-stock.service';
import { CompanyStockController } from './company-stock.controller';
import { PrismaCompanyStockRepository } from './repositories/prisma/prisma-company-stock-repository';
import { CompanyModule as CompanyDomainModule } from 'src/company/company.module';
import { CompanyItemModule } from 'src/company-item/company-item.module';

@Module({
  imports: [CompanyDomainModule, CompanyItemModule],
  controllers: [CompanyStockController],
  providers: [
    CompanyStockService,
    {
      provide: PrismaCompanyStockRepository,
      useClass: PrismaCompanyStockRepository,
    },
  ],
  exports: [PrismaCompanyStockRepository],
})
export class CompanyStockModule {}
