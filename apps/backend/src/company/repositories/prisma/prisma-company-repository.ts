import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CompanyBankAccountInput,
  CompanyMemberWithRole,
  CompanyMemberWithUser,
  CompanyRepository,
  CompanyUpdateData,
  CompanyWithAccessRole,
} from '../company-repository';
import {
  BankAccount,
  Company,
  CompanyMember,
} from 'src/generated/prisma/client/client';

@Injectable()
export class PrismaCompanyRepository implements CompanyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    createdById: string;
    name: string;
    slug: string;
    parentId?: string;
    countryId?: string;
    currencyId: string;
  }): Promise<Company> {
    return this.prisma.company.create({ data });
  }

  async createWithBankAccounts(data: {
    createdById: string;
    name: string;
    slug: string;
    parentId?: string;
    countryId?: string;
    currencyId: string;
    bankAccounts: CompanyBankAccountInput[];
  }): Promise<Company & { bankAccounts: BankAccount[] }> {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          createdById: data.createdById,
          name: data.name,
          slug: data.slug,
          parentId: data.parentId,
          countryId: data.countryId,
          currencyId: data.currencyId,
        },
      });

      const bankAccounts = await Promise.all(
        data.bankAccounts.map((account) =>
          tx.bankAccount.create({
            data: {
              companyId: company.id,
              name: account.name,
              iban: account.iban,
              currencyId: account.currencyId,
              platformId: account.platformId,
              initialBalance: account.initialBalance,
            },
          }),
        ),
      );

      return { ...company, bankAccounts };
    });
  }

  async update(id: string, data: CompanyUpdateData): Promise<Company> {
    return this.prisma.company.update({ where: { id }, data });
  }

  async countPayments(companyId: string): Promise<number> {
    return this.prisma.companyPayment.count({ where: { companyId } });
  }

  async findById(id: string): Promise<Company | null> {
    return this.prisma.company.findUnique({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Company | null> {
    return this.prisma.company.findUnique({ where: { slug } });
  }

  async findAllByCreatedById(createdById: string): Promise<Company[]> {
    return this.prisma.company.findMany({
      where: { createdById },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllAccessibleByUserId(
    userId: string,
  ): Promise<CompanyWithAccessRole[]> {
    const companyInclude = {
      country: true,
      currency: true,
      parent: { select: { id: true, name: true } },
    };

    const [owned, memberships] = await Promise.all([
      this.prisma.company.findMany({
        // Apagada é apagada para quem a apagou — só o suporte a traz de volta
        where: { createdById: userId, status: { not: 'deleted' } },
        orderBy: { createdAt: 'desc' },
        include: companyInclude,
      }),
      this.prisma.companyMember.findMany({
        // Só onde já aceitou o convite
        where: { userId, status: 'active', company: { status: { not: 'deleted' } } },
        include: { company: { include: companyInclude } },
      }),
    ]);

    const ownedWithRole: CompanyWithAccessRole[] = owned.map((company) => ({
      ...company,
      role: 'owner',
    }));
    const memberWithRole: CompanyWithAccessRole[] = memberships.map(
      (membership) => ({
        ...membership.company,
        role: 'member',
      }),
    );

    return [...ownedWithRole, ...memberWithRole];
  }

  async addMember(data: {
    companyId: string;
    userId: string;
    status?: string;
    invitedById?: string;
    invitedAt?: Date;
  }): Promise<CompanyMember> {
    return this.prisma.companyMember.create({ data });
  }

  async findMember(
    companyId: string,
    userId: string,
  ): Promise<CompanyMemberWithRole | null> {
    return this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId } },
      include: { role: { select: { id: true, name: true, permissions: true } } },
    });
  }

  async findMembersByCompanyId(
    companyId: string,
  ): Promise<CompanyMemberWithUser[]> {
    return this.prisma.companyMember.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
        role: { select: { id: true, name: true, permissions: true } },
      },
    });
  }
}
