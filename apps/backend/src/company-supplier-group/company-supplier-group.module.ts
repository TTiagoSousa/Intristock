import { Module } from '@nestjs/common';
import { CompanySupplierGroupService } from './company-supplier-group.service';
import { CompanySupplierGroupController } from './company-supplier-group.controller';
import { PrismaCompanySupplierGroupRepository } from './repositories/prisma/prisma-company-supplier-group-repository';
import { CompanyModule } from 'src/company/company.module';

@Module({
  imports: [CompanyModule],
  controllers: [CompanySupplierGroupController],
  providers: [
    CompanySupplierGroupService,
    {
      provide: PrismaCompanySupplierGroupRepository,
      useClass: PrismaCompanySupplierGroupRepository,
    },
  ],
  exports: [PrismaCompanySupplierGroupRepository],
})
export class CompanySupplierGroupModule {}
