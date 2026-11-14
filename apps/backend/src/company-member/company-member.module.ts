import { Module } from '@nestjs/common';
import { CompanyModule } from 'src/company/company.module';
import { StorageModule } from 'src/storage/storage.module';
import { CompanyMemberController } from './company-member.controller';
import { CompanyMemberService } from './company-member.service';
import { PrismaCompanyMemberRepository } from './repositories/prisma/prisma-company-member-repository';

@Module({
  imports: [CompanyModule, StorageModule],
  controllers: [CompanyMemberController],
  providers: [
    CompanyMemberService,
    {
      provide: PrismaCompanyMemberRepository,
      useClass: PrismaCompanyMemberRepository,
    },
  ],
  // O gráfico dos pagamentos por mês mostra os salários por pagar como previsão
  exports: [PrismaCompanyMemberRepository],
})
export class CompanyMemberModule {}
