import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaCompanyPaymentDocumentRepository } from './repositories/prisma/prisma-company-payment-document-repository';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { PrismaCompanyPaymentRepository } from 'src/company-payment/repositories/prisma/prisma-company-payment-repository';
import { StorageService } from 'src/storage/storage.service';
import { assertPaymentOwnership } from './helpers/assertPaymentOwnership';
import { assertFileIsAllowed, sanitizeFileName } from './helpers/assertFileIsAllowed';

export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class CompanyPaymentDocumentService {
  constructor(
    private readonly documentRepository: PrismaCompanyPaymentDocumentRepository,
    private readonly companyRepository: PrismaCompanyRepository,
    private readonly paymentRepository: PrismaCompanyPaymentRepository,
    private readonly storage: StorageService,
  ) {}

  async upload(userId: string, companyId: string, paymentId: string, file: UploadedFile) {
    await assertPaymentOwnership(
      userId,
      companyId,
      paymentId,
      this.companyRepository,
      this.paymentRepository,
      'payments.edit',
    );

    // O tipo real sai dos bytes, não do que o cliente disse que era
    const mimeType = assertFileIsAllowed(file);
    const fileName = sanitizeFileName(file.originalname);
    const storageKey = this.storage.buildKey(companyId, paymentId, fileName);

    // O ficheiro vai primeiro para o storage: se falhar, não fica uma linha na
    // base de dados a apontar para um objeto que não existe
    await this.storage.put(storageKey, file.buffer, mimeType);

    return this.documentRepository.create({
      paymentId,
      fileName,
      mimeType,
      size: file.size,
      storageKey,
      storageProvider: this.storage.providerName,
    });
  }

  async findAll(userId: string, companyId: string, paymentId: string) {
    await assertPaymentOwnership(
      userId,
      companyId,
      paymentId,
      this.companyRepository,
      this.paymentRepository,
      'payments.view',
    );

    return this.documentRepository.findAllByPaymentId(paymentId);
  }

  async download(userId: string, companyId: string, paymentId: string, documentId: string) {
    await assertPaymentOwnership(
      userId,
      companyId,
      paymentId,
      this.companyRepository,
      this.paymentRepository,
      'payments.view',
    );

    const document = await this.documentRepository.findById(documentId);

    if (!document || document.paymentId !== paymentId) {
      throw new NotFoundException('Documento não encontrado');
    }

    // Lê do storage onde este documento em concreto foi gravado — os antigos
    // continuam a funcionar depois de se trocar de fornecedor
    const stream = await this.storage.get(document.storageKey, document.storageProvider);

    return { document, stream };
  }

  async remove(userId: string, companyId: string, paymentId: string, documentId: string) {
    await assertPaymentOwnership(
      userId,
      companyId,
      paymentId,
      this.companyRepository,
      this.paymentRepository,
      'payments.edit',
    );

    const document = await this.documentRepository.findById(documentId);

    if (!document || document.paymentId !== paymentId) {
      throw new NotFoundException('Documento não encontrado');
    }

    // A linha sai primeiro. Se fosse ao contrário e a base de dados falhasse,
    // ficava um registo a apontar para um ficheiro que já não existe.
    await this.documentRepository.delete(documentId);
    await this.storage.delete(document.storageKey, document.storageProvider);
  }
}
