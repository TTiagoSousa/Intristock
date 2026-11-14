import { BankAccount, CompanyMember, CompanyRole } from 'src/generated/prisma/client/client';

export type CompanyRoleWithCount = CompanyRole & { _count: { members: number } };

export interface CompanyRoleData {
  name: string;
  description: string | null;
  permissions: string[];
}

// Os dados da pessoa como se gravam (vazio = null)
export interface CompanyMemberProfile {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  taxNumber?: string | null;
  socialSecurityNumber?: string | null;
  idDocumentNumber?: string | null;
  birthDate?: Date | null;
  addressLine?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryId?: string | null;
  iban?: string | null;
  currencyId?: string | null;
  bankAccountId?: string | null;
  notes?: string | null;
}

export interface CompanyMemberUpdate extends CompanyMemberProfile {
  userId?: string | null;
  roleId?: string | null;
  extraPermissions?: string[];
  deniedPermissions?: string[];
}

// Um membro com tudo o que a página dele mostra
export type CompanyMemberDetail = CompanyMember & {
  user: { id: string; email: string; fullName: string } | null;
  role: { id: string; name: string } | null;
  country: { id: string; name: string } | null;
  currency: { id: string; shortCode: string; symbol: string } | null;
  bankAccount: { id: string; name: string } | null;
};

// O que um membro tem atrás de si: decide se sai de vez ou fica como registo
export interface CompanyMemberHistory {
  pays: number;
  contracts: number;
  documents: number;
  payments: number;
}

export interface CompanyAccessRepository {
  findRoles(companyId: string): Promise<CompanyRoleWithCount[]>;
  findRole(companyId: string, roleId: string): Promise<CompanyRole | null>;
  findRoleByName(companyId: string, name: string): Promise<CompanyRole | null>;
  createRole(companyId: string, data: CompanyRoleData): Promise<CompanyRole>;
  updateRole(roleId: string, data: Partial<CompanyRoleData>): Promise<CompanyRole>;
  deleteRole(roleId: string): Promise<void>;
  countRoleMembers(roleId: string): Promise<number>;
  findMemberById(companyId: string, memberId: string): Promise<CompanyMember | null>;
  findMemberDetail(companyId: string, memberId: string): Promise<CompanyMemberDetail | null>;
  createRecordMember(companyId: string, data: CompanyMemberProfile): Promise<CompanyMember>;
  updateMember(memberId: string, data: CompanyMemberUpdate): Promise<CompanyMember>;
  countMemberHistory(memberId: string): Promise<CompanyMemberHistory>;
  findCompanyBankAccount(companyId: string, bankAccountId: string): Promise<BankAccount | null>;
  deleteMember(memberId: string): Promise<void>;
}
