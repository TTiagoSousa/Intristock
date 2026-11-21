import { Module } from '@nestjs/common';
import { CompanyModule } from 'src/company/company.module';
import { CompanySupplierModule } from 'src/company-supplier/company-supplier.module';
import { CompanyPaymentModule } from 'src/company-payment/company-payment.module';
import { NotificationModule } from 'src/notification/notification.module';
import { TimeTrackingController } from './time-tracking.controller';
import { TimeTrackingService } from './time-tracking.service';
import { TimeTrackingSyncService } from './time-tracking-sync.service';
import { PrismaTimeTrackingRepository } from './repositories/prisma/prisma-time-tracking-repository';

@Module({
  // Os clientes da app ligam-se (ou criam-se) nos fornecedores da empresa
  // Marcar como pago pode gravar o recebimento na empresa e avisar quem recebe as horas
  imports: [CompanyModule, CompanySupplierModule, CompanyPaymentModule, NotificationModule],
  controllers: [TimeTrackingController],
  providers: [
    TimeTrackingService,
    TimeTrackingSyncService,
    { provide: PrismaTimeTrackingRepository, useClass: PrismaTimeTrackingRepository },
  ],
  exports: [PrismaTimeTrackingRepository],
})
export class TimeTrackingModule {}
