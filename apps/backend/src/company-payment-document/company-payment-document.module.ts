import { Module } from '@nestjs/common';
import { CompanyPaymentDocumentService } from './company-payment-document.service';
import { CompanyPaymentDocumentController } from './company-payment-document.controller';
import { PrismaCompanyPaymentDocumentRepository } from './repositories/prisma/prisma-company-payment-document-repository';
import { CompanyModule } from 'src/company/company.module';
import { CompanyPaymentModule } from 'src/company-payment/company-payment.module';
import { StorageModule } from 'src/storage/storage.module';

@Module({
  imports: [CompanyModule, CompanyPaymentModule, StorageModule],
  controllers: [CompanyPaymentDocumentController],
  providers: [
    CompanyPaymentDocumentService,
    {
      provide: PrismaCompanyPaymentDocumentRepository,
      useClass: PrismaCompanyPaymentDocumentRepository,
    },
  ],
  exports: [PrismaCompanyPaymentDocumentRepository],
})
export class CompanyPaymentDocumentModule {}
