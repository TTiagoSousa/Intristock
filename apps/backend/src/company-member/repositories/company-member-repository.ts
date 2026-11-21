import {
  CompanyMember,
  CompanyMemberContract,
  CompanyMemberDocument,
  CompanyMemberPay,
} from 'src/generated/prisma/client/client';

export interface MemberPayData {
  contractId?: string | null;
  description?: string | null;
  grossAmount?: number;
  paymentsPerYear?: number | null;
  payDay?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  dueDate?: Date | null;
  withholdingPct?: number | null;
  // As propostas a um membro com conta (ver `CompanyMemberPay.status`)
  status?: string;
  proposedById?: string | null;
  respondedAt?: Date | null;
  responseNote?: string | null;
  replacesId?: string | null;
}

export interface MemberContractData {
  type?: string;
  title?: string | null;
  startDate?: Date;
  endDate?: Date | null;
  notes?: string | null;
}

export interface MemberDocumentData {
  memberId: string;
  contractId: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  storageProvider: string;
}

// Um salário com o membro, para os próximos pagamentos
export type MemberPayWithMember = CompanyMemberPay & {
  member: Pick<CompanyMember, 'id' | 'name' | 'bankAccountId'> & {
    user: { fullName: string } | null;
    currency: { id: string; shortCode: string; symbol: string; rate: number } | null;
  };
};

export type MemberPayWithCount = CompanyMemberPay & {
  _count: { payments: number };
};

export interface CompanyMemberRepository {
  findMember(
    companyId: string,
    memberId: string,
  ): Promise<CompanyMember | null>;

  findPays(memberId: string): Promise<MemberPayWithCount[]>;
  findPay(memberId: string, payId: string): Promise<MemberPayWithCount | null>;
  createPay(
    memberId: string,
    kind: string,
    data: MemberPayData,
  ): Promise<CompanyMemberPay>;
  createPayReplacing(
    memberId: string,
    kind: string,
    data: MemberPayData,
    closeReplaced: { id: string; endDate: Date } | null,
  ): Promise<CompanyMemberPay>;
  countPayIncomes(payId: string): Promise<number>;
  updatePay(payId: string, data: MemberPayData): Promise<CompanyMemberPay>;
  deletePay(payId: string): Promise<void>;

  findContracts(memberId: string): Promise<CompanyMemberContract[]>;
  findContract(
    memberId: string,
    contractId: string,
  ): Promise<CompanyMemberContract | null>;
  createContract(
    memberId: string,
    data: MemberContractData,
  ): Promise<CompanyMemberContract>;
  updateContract(
    contractId: string,
    data: MemberContractData,
  ): Promise<CompanyMemberContract>;
  deleteContract(contractId: string): Promise<void>;

  findDocuments(memberId: string): Promise<CompanyMemberDocument[]>;
  findDocument(
    memberId: string,
    documentId: string,
  ): Promise<CompanyMemberDocument | null>;
  createDocument(data: MemberDocumentData): Promise<CompanyMemberDocument>;
  deleteDocument(documentId: string): Promise<void>;

  findCurrency(
    currencyId: string,
  ): Promise<{ id: string; shortCode: string; symbol: string; rate: number } | null>;

  // Os salários e recibos verdes de todos os membros da empresa
  findCompanyPays(companyId: string): Promise<MemberPayWithMember[]>;
  // `payId|período` de cada um já pago (pagamentos concluídos)
  findPaidPeriods(payIds: string[]): Promise<Set<string>>;
}
