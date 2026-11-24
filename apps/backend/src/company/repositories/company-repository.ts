import {
  BankAccount,
  Company,
  CompanyMember,
  Country,
  Currency,
} from 'src/generated/prisma/client/client';

export interface CompanyBankAccountInput {
  name: string;
  iban?: string;
  currencyId: string;
  platformId: string;
  initialBalance?: number;
}

export type CompanyWithAccessRole = Company & {
  role: 'owner' | 'member';
  country: Country | null;
  // A moeda base vai inteira e não só o id: o frontend precisa do símbolo e dos
  // separadores para formatar sem ter de cruzar com a lista de moedas
  currency: Currency;
  parent: { id: string; name: string } | null;
};

export type CompanyMemberWithRole = CompanyMember & {
  role: { id: string; name: string; permissions: string[] } | null;
};

// Sem conta (`userId` nulo) o membro é só um registo, e o `user` vem nulo
export type CompanyMemberWithUser = CompanyMemberWithRole & {
  user: { id: string; email: string; fullName: string } | null;
};

export interface CompanyUpdateData {
  name?: string;
  slug?: string;
  countryId?: string;
  currencyId?: string;
  status?: string;
  deletedAt?: Date | null;
}

export interface CompanyRepository {
  create(data: {
    createdById: string;
    name: string;
    slug: string;
    parentId?: string;
    countryId?: string;
    currencyId: string;
  }): Promise<Company>;
  createWithBankAccounts(data: {
    createdById: string;
    name: string;
    slug: string;
    parentId?: string;
    countryId?: string;
    currencyId: string;
    bankAccounts: CompanyBankAccountInput[];
  }): Promise<Company & { bankAccounts: BankAccount[] }>;
  update(id: string, data: CompanyUpdateData): Promise<Company>;
  // Trava a troca de moeda: com pagamentos gravados, mudá-la alterava o que eles valem
  countPayments(companyId: string): Promise<number>;
  findById(id: string): Promise<Company | null>;
  findBySlug(slug: string): Promise<Company | null>;
  findAllByCreatedById(createdById: string): Promise<Company[]>;
  findAllAccessibleByUserId(userId: string): Promise<CompanyWithAccessRole[]>;
  addMember(data: {
    companyId: string;
    userId: string;
  }): Promise<CompanyMember>;
  findMember(companyId: string, userId: string): Promise<CompanyMemberWithRole | null>;
  findMembersByCompanyId(companyId: string): Promise<CompanyMemberWithUser[]>;
  isModuleActive(companyId: string, moduleName: string): Promise<boolean>;
}
