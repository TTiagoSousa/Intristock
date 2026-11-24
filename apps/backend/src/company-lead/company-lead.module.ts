import { Module } from '@nestjs/common';
import { AppSettingModule } from 'src/app-setting/app-setting.module';
import { CompanyModule } from 'src/company/company.module';
import { CompanyDataModule } from 'src/company-data/company-data.module';
import { NotificationModule } from 'src/notification/notification.module';
import { CompanyLeadController } from './company-lead.controller';
import { CompanyLeadService } from './company-lead.service';
import { CompanyLeadJobsService } from './company-lead-jobs.service';
import { PrismaCompanyLeadRepository } from './repositories/prisma/prisma-company-lead-repository';

// As Leads do call center: as rotas, o serviço e a tarefa em fundo (as automações e os avisos)
@Module({
  imports: [CompanyModule, CompanyDataModule, NotificationModule, AppSettingModule],
  controllers: [CompanyLeadController],
  providers: [CompanyLeadService, CompanyLeadJobsService, PrismaCompanyLeadRepository],
})
export class CompanyLeadModule {}
