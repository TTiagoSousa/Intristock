import { Module } from '@nestjs/common';
import { CompanyModule } from 'src/company/company.module';
import { CompanyDataController } from './company-data.controller';
import { CompanyDataConnectionController } from './company-data-connection.controller';
import { CompanyDataConnectionService } from './company-data-connection.service';
import { CompanyDataService } from './company-data.service';
import { PrismaCompanyDataRepository } from './repositories/prisma/prisma-company-data-repository';

@Module({
  imports: [CompanyModule],
  // As ligações antes das tabelas: «connections/fields» não pode cair noutra rota
  controllers: [CompanyDataConnectionController, CompanyDataController],
  providers: [CompanyDataService, CompanyDataConnectionService, PrismaCompanyDataRepository],
  // As campanhas do call center vão ler as tabelas unidas por aqui
  exports: [CompanyDataService],
})
export class CompanyDataModule {}
