import { Module } from '@nestjs/common';
import { CompanyModuleService } from './company-module.service';
import { CompanyModuleController } from './company-module.controller';
import { PrismaCompanyModuleRepository } from './repositories/prisma/prisma-company-module-repository';
import { CompanyModule as CompanyDomainModule } from 'src/company/company.module';
import { SystemModuleModule } from 'src/module/module.module';

@Module({
  imports: [CompanyDomainModule, SystemModuleModule],
  controllers: [CompanyModuleController],
  providers: [
    CompanyModuleService,
    {
      provide: PrismaCompanyModuleRepository,
      useClass: PrismaCompanyModuleRepository,
    },
  ],
  exports: [PrismaCompanyModuleRepository],
})
export class CompanyModuleModule {}
