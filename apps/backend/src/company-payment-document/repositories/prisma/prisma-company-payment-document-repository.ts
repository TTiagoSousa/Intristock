import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CompanyPaymentDocumentData,
  CompanyPaymentDocumentRepository,
} from '../company-payment-document-repository';
import { CompanyPaymentDocument } from 'src/generated/prisma/client/client';

@Injectable()
export class PrismaCompanyPaymentDocumentRepository implements CompanyPaymentDocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CompanyPaymentDocumentData): Promise<CompanyPaymentDocument> {
    return this.prisma.companyPaymentDocument.create({ data });
  }

  async findById(id: string): Promise<CompanyPaymentDocument | null> {
    return this.prisma.companyPaymentDocument.findUnique({ where: { id } });
  }

  async findAllByPaymentId(paymentId: string): Promise<CompanyPaymentDocument[]> {
    return this.prisma.companyPaymentDocument.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.companyPaymentDocument.delete({ where: { id } });
  }
}
