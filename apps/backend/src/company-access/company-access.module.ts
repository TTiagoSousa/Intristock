import { Module } from '@nestjs/common';
import { CompanyModule } from 'src/company/company.module';
import { UserModule } from 'src/user/user.module';
import { CompanyInvitationModule } from 'src/company-invitation/company-invitation.module';
import { CompanyAccessController, CompanyPermissionsController } from './company-access.controller';
import { CompanyAccessService } from './company-access.service';
import { PrismaCompanyAccessRepository } from './repositories/prisma/prisma-company-access-repository';

@Module({
  imports: [CompanyModule, UserModule, CompanyInvitationModule],
  controllers: [CompanyPermissionsController, CompanyAccessController],
  providers: [
    CompanyAccessService,
    {
      provide: PrismaCompanyAccessRepository,
      useClass: PrismaCompanyAccessRepository,
    },
  ],
})
export class CompanyAccessModule {}
