import { Module } from '@nestjs/common';
import { NotificationModule } from 'src/notification/notification.module';
import { CompanyInvitationController } from './company-invitation.controller';
import { CompanyInvitationService } from './company-invitation.service';
import { PrismaCompanyInvitationRepository } from './repositories/prisma/prisma-company-invitation-repository';
import { PrismaTimeTrackingRepository } from 'src/time-tracking/repositories/prisma/prisma-time-tracking-repository';

// Não importa os módulos das empresas (são eles que o importam): lê e grava pelo próprio repositório
@Module({
  imports: [NotificationModule],
  controllers: [CompanyInvitationController],
  providers: [
    CompanyInvitationService,
    { provide: PrismaCompanyInvitationRepository, useClass: PrismaCompanyInvitationRepository },
    // Para gravar a resposta a um payout do banco de horas. Só precisa do Prisma, por isso vem
    // como provider e não pelo módulo (o banco de horas importa os pagamentos, que importam este)
    PrismaTimeTrackingRepository,
  ],
  exports: [CompanyInvitationService],
})
export class CompanyInvitationModule {}
