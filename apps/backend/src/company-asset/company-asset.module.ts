import { Module } from '@nestjs/common';
import { CompanyAssetService } from './company-asset.service';
import { CompanyAssetController } from './company-asset.controller';
import { PrismaCompanyAssetRepository } from './repositories/prisma/prisma-company-asset-repository';
import { CompanyModule as CompanyDomainModule } from 'src/company/company.module';
import { CurrencyModule } from 'src/currency/currency.module';
import { CompanyItemModule } from 'src/company-item/company-item.module';

@Module({
  imports: [CompanyDomainModule, CurrencyModule, CompanyItemModule],
  controllers: [CompanyAssetController],
  providers: [
    CompanyAssetService,
    {
      provide: PrismaCompanyAssetRepository,
      useClass: PrismaCompanyAssetRepository,
    },
  ],
  exports: [PrismaCompanyAssetRepository],
})
export class CompanyAssetModule {}
