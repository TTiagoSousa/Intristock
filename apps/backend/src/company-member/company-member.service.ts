import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaCompanyRepository } from 'src/company/repositories/prisma/prisma-company-repository';
import { StorageService } from 'src/storage/storage.service';
import {
  assertFileIsAllowed,
  sanitizeFileName,
} from 'src/company-payment-document/helpers/assertFileIsAllowed';
import { PrismaCompanyMemberRepository } from './repositories/prisma/prisma-company-member-repository';
import { CreateMemberPayDto, UpdateMemberPayDto } from './dto/member-pay.dto';
import {
  CreateMemberContractDto,
  UpdateMemberContractDto,
} from './dto/member-contract.dto';
import { UpcomingPaymentsQueryDto } from './dto/upcoming-payments-query.dto';
import { assertMemberAccess } from './helpers/assertMemberAccess';
import { saveMemberPay } from './helpers/saveMemberPay';
import { deleteMemberPay } from './helpers/deleteMemberPay';
import { saveMemberContract } from './helpers/saveMemberContract';
import { findUpcomingMemberPayments } from './helpers/findUpcomingMemberPayments';

export interface UploadedMemberFile {
  originalname: string;
  buffer: Buffer;
  size: number;
}

/**
 * O que se paga aos membros (salários e recibos verdes), os contratos e os
 * documentos deles, e os próximos pagamentos. Tudo com `salaries.view` para ler
 * e `salaries.manage` para gravar.
 */
@Injectable()
export class CompanyMemberService {
  constructor(
    private readonly companyRepository: PrismaCompanyRepository,
    private readonly memberRepository: PrismaCompanyMemberRepository,
    private readonly storage: StorageService,
  ) {}

  private assert(
    userId: string,
    companyId: string,
    memberId: string,
    write = false,
  ) {
    return assertMemberAccess(
      userId,
      companyId,
      memberId,
      write ? 'salaries.manage' : 'salaries.view',
      this.companyRepository,
      this.memberRepository,
    );
  }

  async findPays(userId: string, companyId: string, memberId: string) {
    await this.assert(userId, companyId, memberId);
    return this.memberRepository.findPays(memberId);
  }

  savePay(
    userId: string,
    companyId: string,
    memberId: string,
    payId: string | null,
    dto: CreateMemberPayDto | UpdateMemberPayDto,
  ) {
    return saveMemberPay(
      userId,
      companyId,
      memberId,
      payId,
      dto,
      this.companyRepository,
      this.memberRepository,
    );
  }

  deletePay(
    userId: string,
    companyId: string,
    memberId: string,
    payId: string,
  ) {
    return deleteMemberPay(
      userId,
      companyId,
      memberId,
      payId,
      this.companyRepository,
      this.memberRepository,
    );
  }

  async findContracts(userId: string, companyId: string, memberId: string) {
    await this.assert(userId, companyId, memberId);
    return this.memberRepository.findContracts(memberId);
  }

  saveContract(
    userId: string,
    companyId: string,
    memberId: string,
    contractId: string | null,
    dto: CreateMemberContractDto | UpdateMemberContractDto,
  ) {
    return saveMemberContract(
      userId,
      companyId,
      memberId,
      contractId,
      dto,
      this.companyRepository,
      this.memberRepository,
    );
  }

  async deleteContract(
    userId: string,
    companyId: string,
    memberId: string,
    contractId: string,
  ) {
    await this.assert(userId, companyId, memberId, true);
    if (!(await this.memberRepository.findContract(memberId, contractId))) {
      throw new NotFoundException('Contrato não encontrado');
    }
    // Os salários e os documentos dele ficam, soltos no membro
    await this.memberRepository.deleteContract(contractId);
  }

  async findDocuments(userId: string, companyId: string, memberId: string) {
    await this.assert(userId, companyId, memberId);
    return this.memberRepository.findDocuments(memberId);
  }

  async uploadDocument(
    userId: string,
    companyId: string,
    memberId: string,
    contractId: string | null,
    file: UploadedMemberFile,
  ) {
    await this.assert(userId, companyId, memberId, true);
    if (
      contractId &&
      !(await this.memberRepository.findContract(memberId, contractId))
    ) {
      throw new NotFoundException('Contrato não encontrado');
    }

    // O tipo real sai dos bytes, como nos documentos dos pagamentos
    const mimeType = assertFileIsAllowed(file);
    const fileName = sanitizeFileName(file.originalname);
    const storageKey = this.storage.buildMemberKey(
      companyId,
      memberId,
      fileName,
    );

    // Primeiro o ficheiro: se falhar, não fica uma linha a apontar para nada
    await this.storage.put(storageKey, file.buffer, mimeType);

    return this.memberRepository.createDocument({
      memberId,
      contractId,
      fileName,
      mimeType,
      size: file.size,
      storageKey,
      storageProvider: this.storage.providerName,
    });
  }

  async downloadDocument(
    userId: string,
    companyId: string,
    memberId: string,
    documentId: string,
  ) {
    await this.assert(userId, companyId, memberId);
    const document = await this.memberRepository.findDocument(
      memberId,
      documentId,
    );
    if (!document) throw new NotFoundException('Documento não encontrado');

    const stream = await this.storage.get(
      document.storageKey,
      document.storageProvider,
    );
    return { document, stream };
  }

  async deleteDocument(
    userId: string,
    companyId: string,
    memberId: string,
    documentId: string,
  ) {
    await this.assert(userId, companyId, memberId, true);
    const document = await this.memberRepository.findDocument(
      memberId,
      documentId,
    );
    if (!document) throw new NotFoundException('Documento não encontrado');

    // A linha sai primeiro: se o storage falhar fica só um ficheiro órfão no bucket
    await this.memberRepository.deleteDocument(documentId);
    await this.storage.delete(document.storageKey, document.storageProvider);
  }

  findUpcoming(
    userId: string,
    companyId: string,
    query: UpcomingPaymentsQueryDto,
  ) {
    return findUpcomingMemberPayments(
      userId,
      companyId,
      query,
      this.companyRepository,
      this.memberRepository,
    );
  }
}
